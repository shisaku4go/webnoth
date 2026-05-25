import {
  formatTerrainName,
  getAdvancesFrom,
  getAllEras,
  getAllRaces,
  getAllUnits,
  getDamageTypes,
  getEffectiveDefense,
  getEffectiveMoveCosts,
  getEffectiveResistance,
  getFactionsByEra,
  getFactionUnits,
  getMovetypeByName,
  getRaceById,
  getTotalUnitCount,
  getUnitById,
  getUnitCountByRace,
  getUnitsByRace,
  searchUnits,
} from '../wesnoth-data';

describe('wesnoth-data basic retrieval functions', () => {
  it('getAllUnits should return an array of units, omitting hidden ones', () => {
    const units = getAllUnits();
    expect(Array.isArray(units)).toBe(true);
    expect(units.length).toBeGreaterThan(0);
    // ensure no hidden units are returned
    for (const unit of units) {
      expect(unit.doNotList).toBeFalsy();
      expect(unit.hideHelp).toBeFalsy();
    }
  });

  it('getUnitById should return a unit by id or undefined if not found', () => {
    // Assuming 'spearman' or similar common unit exists in the data
    const units = getAllUnits();
    const firstUnit = units[0];

    if (firstUnit) {
      const foundUnit = getUnitById(firstUnit.id);
      expect(foundUnit).toBeDefined();
      expect(foundUnit?.id).toBe(firstUnit.id);
    }

    const notFound = getUnitById('non_existent_unit_123');
    expect(notFound).toBeUndefined();
  });

  it('getAllRaces should return an array of races', () => {
    const races = getAllRaces();
    expect(Array.isArray(races)).toBe(true);
    expect(races.length).toBeGreaterThan(0);
  });

  it('getRaceById should return a race by id or undefined if not found', () => {
    const races = getAllRaces();
    const firstRace = races[0];

    if (firstRace) {
      const foundRace = getRaceById(firstRace.id);
      expect(foundRace).toBeDefined();
      expect(foundRace?.id).toBe(firstRace.id);
    }

    const notFound = getRaceById('non_existent_race_123');
    expect(notFound).toBeUndefined();
  });

  it('getMovetypeByName should return a movetype by name or undefined if not found', () => {
    const found = getMovetypeByName('smallfoot');
    if (found) {
      expect(found.name).toBe('smallfoot');
    }
    const notFound = getMovetypeByName('non_existent_movetype_123');
    expect(notFound).toBeUndefined();
  });

  it('getDamageTypes should return all 6 standard damage types', () => {
    const damageTypes = getDamageTypes();
    expect(damageTypes).toEqual([
      'blade',
      'pierce',
      'impact',
      'fire',
      'cold',
      'arcane',
    ]);
  });
});

describe('wesnoth-data relational functions', () => {
  it('getUnitsByRace should return units belonging to a specific race', () => {
    const units = getUnitsByRace('human');
    expect(Array.isArray(units)).toBe(true);
    for (const unit of units) {
      expect(unit.race).toBe('human');
      expect(unit.doNotList).toBeFalsy();
      expect(unit.hideHelp).toBeFalsy();
    }
  });

  it('getUnitCountByRace should return correct count of listable units', () => {
    const units = getUnitsByRace('human');
    const count = getUnitCountByRace('human');
    // Ensure the count matches the listable units length
    expect(count).toBe(units.length);

    expect(getUnitCountByRace('non_existent_race')).toBe(0);
  });

  it('getAdvancesFrom should return list of unit IDs that advance to the given ID', () => {
    // spearman advances to pikeman, javelineer, swordsman
    // So getAdvancesFrom('pikeman') should include 'spearman'
    const advances = getAdvancesFrom('pikeman');
    expect(Array.isArray(advances)).toBe(true);
    // Might be empty if data doesn't contain pikeman/spearman, but if it does:
    if (advances.length > 0) {
      expect(advances).toContain('spearman');
    }

    expect(getAdvancesFrom('non_existent_unit')).toEqual([]);
  });
});

describe('wesnoth-data era/faction relational functions', () => {
  it('getAllEras should return an array of eras', () => {
    const eras = getAllEras();
    expect(Array.isArray(eras)).toBe(true);
    // At least one era should be present
    if (eras.length > 0) {
      expect(eras[0]).toHaveProperty('id');
      expect(eras[0]).toHaveProperty('name');
    }
  });

  it('getFactionsByEra should return factions for a specific era', () => {
    const eras = getAllEras();
    if (eras.length > 0) {
      const factions = getFactionsByEra(eras[0].id);
      expect(Array.isArray(factions)).toBe(true);
      for (const faction of factions) {
        expect(faction.eraId).toBe(eras[0].id);
      }
    }

    expect(getFactionsByEra('non_existent_era')).toEqual([]);
  });

  it('getFactionUnits should return all valid units for a faction (leaders + recruits + advances)', () => {
    const eras = getAllEras();
    if (eras.length > 0) {
      const factions = getFactionsByEra(eras[0].id);
      if (factions.length > 0) {
        const faction = factions[0];
        const units = getFactionUnits(eras[0].id, faction.id);
        expect(Array.isArray(units)).toBe(true);
        // Ensure units are sorted by name
        const sortedUnits = [...units].sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        expect(units).toEqual(sortedUnits);
      }
    }
    expect(getFactionUnits('non', 'existent')).toEqual([]);
  });
});

describe('wesnoth-data calculation & search functions', () => {
  it('searchUnits should return units matching query case-insensitively', () => {
    // A search for 'spear' should return spearman, etc.
    const results = searchUnits('spear');
    expect(Array.isArray(results)).toBe(true);
    if (results.length > 0) {
      for (const res of results) {
        expect(res.name.toLowerCase()).toContain('spear');
      }
    }

    // empty query returns all valid units
    expect(searchUnits('').length).toBe(getAllUnits().length);

    // non-matching
    expect(searchUnits('this_is_a_string_that_does_not_exist')).toEqual([]);
  });

  it('formatTerrainName should format terrain key correctly', () => {
    expect(formatTerrainName('shallow_water')).toBe('Shallow Water');
    expect(formatTerrainName('flat')).toBe('Flat');
    expect(formatTerrainName('swamp_water')).toBe('Swamp Water');
  });

  it('getTotalUnitCount should return number of non-hidden units', () => {
    const total = getTotalUnitCount();
    const all = getAllUnits();
    expect(total).toBe(all.length);
  });

  it('getEffectiveResistance should calculate resistance correctly', () => {
    // using spearman (smallfoot)
    const spearman = getUnitById('spearman');
    if (spearman) {
      const res = getEffectiveResistance(spearman);
      expect(res).toBeDefined();
      expect(typeof res.blade).toBe('number');
      // smallfoot blade resistance is typically 100 base -> 0% resistance (100 - 100 = 0)
      // If no override, it should have the properties.
    }
  });

  it('getEffectiveMoveCosts should compute movement costs', () => {
    const spearman = getUnitById('spearman');
    if (spearman) {
      const moves = getEffectiveMoveCosts(spearman);
      expect(moves).toBeDefined();
      expect(typeof moves.flat).toBe('number');
    }
  });

  it('getEffectiveDefense should calculate defense properly', () => {
    const spearman = getUnitById('spearman');
    if (spearman) {
      const defense = getEffectiveDefense(spearman);
      expect(defense).toBeDefined();
      // Defense returns 100 - rawValue. e.g. 60 raw => 40
      expect(typeof defense.flat).toBe('number');
    }
  });
});
