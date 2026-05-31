import { WesnothBattleManager } from '@/lib/combat/battle-manager';
import { formatTerrainName, getUnitById } from '@/lib/wesnoth-data';
import type { TacticalUnitState } from './pathfinder';
import { getTerrainKeysForCell } from './pathfinder';
import type { PuzzleStage } from './stages';

/**
 * Maps abbreviated terrain codes to descriptive names.
 */
const TERRAIN_CODE_NAMES: Record<string, string> = {
  Gg: 'Grassland',
  'Gg^Fp': 'Forest',
  'Gg^Vh': 'Village',
  Mm: 'Mountains',
  Hh: 'Hills',
  Ch: 'Castle',
  Kh: 'Keep',
  Ww: 'Water',
  Ss: 'Swamp',
};

/**
 * Generates an English text prompt context for the AI Tactician.
 */
export function generateTacticalContext(
  stage: PuzzleStage,
  units: TacticalUnitState[],
  turn: number,
  actionLogs: { id: string; text: string }[],
): string {
  const width = stage.width;
  const height = stage.height;

  // 1. Stage Parameters & Overview
  let prompt = `=== WESNOTH TACTICAL PUZZLE - AI TACTICIAN PROMPT CONTEXT ===\n\n`;
  prompt += `You are an AI military advisor (Tactician) assisting the player in a game of "Wesnoth Tactical Puzzles".\n`;
  prompt += `Analyze the current game state and provide optimal tactical moves for this turn.\n\n`;

  prompt += `### Stage Overview\n`;
  prompt += `- Stage Name: ${stage.name}\n`;
  prompt += `- Turn: ${turn} / ${stage.turnLimit} (Remaining Turns: ${Math.max(0, stage.turnLimit - turn + 1)})\n`;
  prompt += `- Victory Objective: Defeat all enemies (defeat_all)\n`;
  prompt += `- Stage Description: ${stage.description}\n\n`;

  // 2. Adjacency & Movement Rules explanation
  prompt += `### Hex Grid Coordinates & Movement Rules\n`;
  prompt += `- The map is a hexagonal grid with columns x=1..${width} and rows y=1..${height}.\n`;
  prompt += `- Adjacency for a cell at (x, y) depends on whether the column x is odd or even (using 1-based index):\n`;
  prompt += `  * If column x is ODD (1, 3, 5...): adjacent cells are (x, y-1), (x, y+1), (x-1, y-1), (x-1, y), (x+1, y-1), (x+1, y).\n`;
  prompt += `  * If column x is EVEN (2, 4, 6...): adjacent cells are (x, y-1), (x, y+1), (x-1, y), (x-1, y+1), (x+1, y), (x+1, y+1).\n`;
  prompt += `  (Only coordinates within 1 <= x <= ${width} and 1 <= y <= ${height} are valid.)\n`;
  prompt += `- Zone of Control (ZoC): A unit cannot move past tiles adjacent to active enemy units of level > 0 unless it has the "skirmisher" ability (movement is forced to stop upon entering an enemy adjacent hex).\n`;
  prompt += `- Combat: Attacks can be melee or ranged. Melee attacks are only countered by melee attacks; ranged attacks are only countered by ranged attacks. If a defender lacks a matching range attack, it cannot counter-attack. Terrain defense represents the chance a unit dodges an attack (e.g. 60% defense means the attacker has only a 40% chance to hit).\n\n`;

  // 3. Collect Unique Terrains on this Map
  const uniqueTerrains = new Set<string>();
  const uniqueBaseKeys = new Set<string>();
  for (const row of stage.grid) {
    for (const cell of row) {
      uniqueTerrains.add(cell);
      const keys = getTerrainKeysForCell(cell);
      for (const k of keys) {
        uniqueBaseKeys.add(k);
      }
    }
  }

  prompt += `### Terrains Present on Map\n`;
  Array.from(uniqueTerrains).forEach((code) => {
    const name = TERRAIN_CODE_NAMES[code] || formatTerrainName(code);
    const keys = getTerrainKeysForCell(code);
    prompt += `- "${code}": ${name} (Base types: ${keys.join(', ')})`;
    if (code.includes('^Vh')) {
      prompt += ` [Heals occupant +8 HP at start of turn, and cures poison]`;
    }
    prompt += `\n`;
  });
  prompt += `\n`;

  // 4. Dynamic Terrain defense/move cost stats for each unit class
  const uniqueUnitTypeIds = Array.from(new Set(units.map((u) => u.unitTypeId)));
  prompt += `### Unit Terrain Adaptations (Defense % / Movement Cost)\n`;
  uniqueUnitTypeIds.forEach((typeId) => {
    const unitType = getUnitById(typeId);
    if (!unitType) return;
    prompt += `- **${unitType.name}**:\n`;
    Array.from(uniqueBaseKeys).forEach((baseKey) => {
      const stats = WesnothBattleManager.resolveTerrainValues(
        unitType,
        baseKey,
      );
      const defensePct = 100 - stats.defenseChanceToHit;
      const cost = stats.movementCost;
      prompt += `  * ${baseKey}: Defense ${defensePct}%, Move Cost: ${cost === 99 ? 'Impassable' : cost}\n`;
    });
  });
  prompt += `\n`;

  // Helper to format unit state
  const formatUnit = (u: TacticalUnitState) => {
    const unitType = getUnitById(u.unitTypeId);
    let str = `- **${u.name}** (${unitType?.name || u.unitTypeId}, Level ${u.level})\n`;
    str += `  * Position: (x=${u.x + 1}, y=${u.y + 1})\n`;
    str += `  * HP: ${u.hp} / ${u.maxHp}\n`;
    str += `  * XP: ${u.xp} / ${u.maxXp}\n`;
    str += `  * Moves Left: ${u.moves} / ${u.maxMoves}\n`;

    // Statuses
    const activeStatuses: string[] = [];
    if (u.statuses.poisoned) activeStatuses.push('Poisoned (-8 HP per turn)');
    if (u.statuses.slowed)
      activeStatuses.push('Slowed (Halved movement and damage)');
    if (u.statuses.petrified) activeStatuses.push('Petrified');
    str += `  * Status: ${activeStatuses.length > 0 ? activeStatuses.join(', ') : 'Normal'}\n`;

    // Activity State
    let activityState = 'Ready';
    if (u.hasAttacked) {
      activityState = 'Exhausted (Attacked)';
    } else if (u.moves === 0) {
      activityState =
        'Moved (Cannot move further, but can still attack if adjacent to enemy)';
    }
    str += `  * Current State: ${activityState}\n`;

    // Traits
    const visibleTraits = u.traits.filter((t) => !t.startsWith('resistance_'));
    if (visibleTraits.length > 0) {
      str += `  * Traits: ${visibleTraits.join(', ')}\n`;
    }

    // Attacks
    if (unitType?.attacks && unitType.attacks.length > 0) {
      str += `  * Attacks:\n`;
      // Apply trait modifications to attacks for accuracy
      const modifiedAttacks = WesnothBattleManager.getModifiedAttacks(
        unitType,
        u,
      );
      modifiedAttacks.forEach((att) => {
        const dmg = u.statuses.slowed ? Math.floor(att.damage / 2) : att.damage;
        str += `    - ${att.name}: ${dmg} damage x ${att.number} strikes (${att.range}, type: ${att.type})`;
        if (att.specials && att.specials.length > 0) {
          str += ` [Specials: ${att.specials.join(', ')}]`;
        }
        str += `\n`;
      });
    }
    return str;
  };

  // 5. Player Units (Side 1)
  const playerUnits = units.filter((u) => u.side === 1);
  prompt += `### Player Units (Side 1)\n`;
  if (playerUnits.length > 0) {
    playerUnits.forEach((u) => {
      prompt += formatUnit(u) + `\n`;
    });
  } else {
    prompt += `None (Defeated)\n\n`;
  }

  // 6. Enemy Units (Side 2)
  const enemyUnits = units.filter((u) => u.side === 2);
  prompt += `### Enemy Units (Side 2)\n`;
  if (enemyUnits.length > 0) {
    enemyUnits.forEach((u) => {
      prompt += formatUnit(u) + `\n`;
    });
  } else {
    prompt += `None (All Defeated! Victory is near)\n\n`;
  }

  // 7. Map representation ASCII
  prompt += `### Map Grid Layout (Row by Row)\n`;
  prompt += `Row 0 is offset from the top. Odd-indexed x columns are shifted slightly higher than even columns in the Hex layout.\n`;
  for (let r = 0; r < height; r++) {
    let rowStr = `Row ${r + 1} (y=${r + 1}): `;
    const cells: string[] = [];
    for (let c = 0; c < width; c++) {
      const occupant = units.find((u) => u.x === c && u.y === r);
      const occupantStr = occupant ? ` [Unit: ${occupant.name}]` : '';
      cells.push(`(${c + 1},${r + 1}): ${stage.grid[r][c]}${occupantStr}`);
    }
    rowStr += cells.join(' | ');
    prompt += rowStr + `\n`;
  }
  prompt += `\n`;

  // 8. Recent Battle logs
  prompt += `### Recent Battle Logs\n`;
  const recentLogs = actionLogs.slice(0, 12).reverse();
  if (recentLogs.length > 0) {
    recentLogs.forEach((log) => {
      prompt += `- ${log.text}\n`;
    });
  } else {
    prompt += `- No actions recorded yet.\n`;
  }
  prompt += `\n`;

  // 9. Strategic Questions Footer
  prompt += `=== Prompt instructions for the AI ===\n`;
  prompt += `Based on the above detailed game status, please formulate the best move set for this turn. Identify which unit should move to which (x, y) coordinates, in what sequence, and which enemy unit they should attack using which weapon to maximize success and minimize damage. Explain your reasoning clearly.`;

  return prompt;
}
