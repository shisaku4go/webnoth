# Battle Logic of Battle for Wesnoth

This document summarizes the core battle mechanics, formulas, and parameters used in the Battle for Wesnoth game engine, based on the source code in `src/actions/attack.cpp`, `src/actions/attack.hpp`, `src/attack_prediction.cpp`, and the core WML weapon specials.

---

## 1. Combat Loop & Flow

Each combat engagement between an attacker and a defender proceeds through a defined set of steps:

1. **Weapon Selection**:
   - The attacker selects the best weapon using [choose_attacker_weapon](file:///Users/staka/repos/wesnoth/src/actions/attack.cpp#L415).
   - The defender reacts by choosing the best weapon of matching range (`melee` or `ranged`) using [choose_defender_weapon](file:///Users/staka/repos/wesnoth/src/actions/attack.cpp#L469). If no weapon of the same range is available, the defender cannot counterattack (weapon index is set to `-1`).
   
2. **Initialization**:
   - The engine triggers WML events `pre_attack` and `attack`.
   - Combat stats are initialized, including:
     - **Base Damage** and **Chance to Hit (CTH)**.
     - **Swarm Blows**: The initial number of attacks (`num_blows`) is calculated, which may scale with HP if the `swarm` special is present.
     - **XP Allocation**: Potential combat and kill experience are determined.
     
3. **Striking Order & Rounds**:
   - **First Strike**: If one unit has the `firststrike` special and the other does not, that unit strikes first. If both or neither have it, the attacker strikes first.
   - **Berserk**: The fight continues for 1 round unless a weapon has the `berserk` special, which forces combat to continue for up to 30 rounds or until one of the units dies.
   
4. **The Combat Loop**:
   - Attacks alternate between attacker and defender.
   - For each strike:
     - A random roll determines if the strike hits or misses based on CTH.
     - If it hits, damage is dealt, and specials (poison, slow, petrify, drain, etc.) are applied.
     - If the target dies, combat terminates immediately, the killer gains kill XP, and WML events/abilities like `plague` are resolved.

---

## 2. Key Formulas

### A. Damage Calculation
The final damage per hit is computed using:

`damage = round_damage(base_damage, multiplier, 10000)`

For a slowed unit:

`slow_damage = round_damage(base_damage, multiplier, 20000)`

#### The `round_damage` Helper ([math.hpp:L78](file:///Users/staka/repos/wesnoth/src/utils/math.hpp#L78)):
Rounded to the closest integer, but always at least 1 (unless base damage is 0):
```cpp
constexpr int round_damage(double base_damage, int bonus, int divisor) {
	if (base_damage == 0) return 0;
	const int rounding = divisor / 2 - (bonus <= divisor || divisor == 1 ? 0 : 1);
	return std::max<int>(1, static_cast<int>(base_damage * bonus + rounding) / divisor);
}
```

#### Multiplier Components (Starts at 100%):
1. **Time of Day (TOD)**: Adds/subtracts a percentage based on alignment:
   - **Lawful**: + lawful_bonus (e.g. +25% at day, -25% at night)
   - **Chaotic**: - lawful_bonus
   - **Liminal**: + (max_liminal_bonus - absolute_value(lawful_bonus)) (e.g. +25% at dawn/dusk, 0% otherwise)
   - **Neutral**: 0%
   - *Fearless Trait*: Negative TOD modifiers are ignored (bonus = max(bonus, 0)).
2. **Leadership Bonus**: Adds percentage if adjacent to a friendly higher-level leader (e.g. +25% per level difference).
3. **Resistance Modifier**: The multiplier is multiplied by the target's resistance percentage to the damage type.
   - *Example*: A unit with 40% resistance takes 40% damage (multiplier is scaled by 40).
4. **Charge Special**: If active (offense-only), the damage multiplier is multiplied by 2 for both attacker and defender.

---

### B. Chance to Hit (CTH)
The base chance to hit is determined by the defender's defense rating on their current terrain:

`base_cth = 100% - defender_defense`

This is modified by [modified_chance_to_hit](file:///Users/staka/repos/wesnoth/src/units/attack_type.cpp#L852):

`cth = clamp(base_cth + accuracy - parry, 0, 100)`

Where:
- **accuracy**: The attacker's weapon accuracy bonus (e.g. +10% for Honed).
- **parry**: The defender's weapon parry penalty.
- Special abilities may override this CTH:
  - **Magical**: Overrides CTH to a flat 70%.
  - **Marksman**: Sets a floor of 60% when attacking (if CTH was lower, it becomes 60%).

---

### C. Swarm Special (Dynamic Blows)
Under the `swarm` special, the number of strikes scales linearly with the unit's HP:
```cpp
inline unsigned swarm_blows(unsigned min_blows, unsigned max_blows, unsigned hp, unsigned max_hp)
{
	return hp >= max_hp
		? max_blows
		: max_blows < min_blows
			? min_blows - (min_blows - max_blows) * hp / max_hp
			: min_blows + (max_blows - min_blows) * hp / max_hp;
}
```

---

### D. Experience Points (XP)
XP is awarded upon combat resolution:
1. **No Kill**:
   - Attacker gets: combat_experience * defender_level (Default combat_experience = 1)
   - Defender gets: combat_experience * attacker_level
   - If opponent is level 0, 0 XP is awarded.
2. **Kill**:
   - Killer gets:
     - If victim is level 0: kill_experience / 2 (Default 8 / 2 = 4 XP)
     - If victim is level 1 or higher: kill_experience * victim_level (Default 8 * level XP)
   - Victim gets: 0 XP.

---

### E. Health Draining
If a weapon drains, the healing amount per hit is calculated as:

`drain_damage = floor(damage_done * drain_percent / 100) + drain_constant`

- Default `drain_percent` is 50%.
- Drained health cannot heal the attacker beyond their maximum hit points.
- If the drain amount is negative (due to custom configs), it deals damage to the attacker but cannot reduce them below 1 HP.
- Draining has no effect on targets with the `undrainable` state (e.g. Undead).

---

## 3. Combat Specials & State Effects

- **Poison**:
  - Inflicted on living, non-poison-immune targets.
  - Deals 8 HP damage at the start of the unit's turn, down to a minimum of 1 HP (poison alone cannot kill).
- **Slow**:
  - Halves the damage dealt by the unit (recalculated instantly mid-combat).
  - Doubles movement cost.
  - Wears off at the end of the unit's next turn.
- **Petrify**:
  - Turns target to stone.
  - Terminates combat immediately.
  - Petrified units cannot move, attack, or retaliate.
- **Plague**:
  - Resurrects a defeated enemy on the killer's side (usually as a Walking Corpse).
  - Does not trigger if the target is Undead or if the fight took place inside a village.

---

## 4. Attack Prediction (Combat Outcomes)

To show prediction statistics and assist the AI in choosing targets, Wesnoth uses a high-performance prediction algorithm in `src/attack_prediction.cpp`:

1. **State Matrix (`prob_matrix`)**:
   - A sparse matrix tracking probability distributions of:
     - Attacker HP vs. Defender HP
     - Slowed states (tracks whether attacker, defender, or both are slowed).
2. **Optimization Levels**:
   - **One Strike**: Special optimization for single-strike encounters.
   - **No Death**: Optimization when total max damage is less than current HP.
   - **Probability Calculation**: A dynamic programming approach that shifts probabilities down rows (attacker taking damage) or columns (defender taking damage) as strikes occur.
   - **Monte Carlo Simulation**: Used for extremely complex combat scenarios (e.g., berserk combat with swarm and health drain) where the number of possible states exceeds a complexity threshold of 50,000.

### Weapon Selection Valuation (`better_combat`):
When comparing combat choices (e.g. for AI or weapon auto-selection), the engine uses a weighted valuation:
1. **Primary Score**:
   
   `Score = P(we kill them) - P(they kill us) * harm_weight`
   
   A higher score is preferred. If the difference is > 1%, the choice is made.
2. **Secondary Score** (if primary difference is <= 1%):
   
   `Score = (Avg HP - P(we are poisoned) * 8) * harm_weight + Expected Damage to opponent + P(opponent is poisoned) * 8`
   
3. **Tertiary Comparison**:
   All else equal, choose the option that deals the most expected damage.
