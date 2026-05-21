# Battle for Wesnoth: Unit Recruitment & Parameter Generation Logic

This document summarizes the technical details of the unit recruitment flow and the parameter generation process for newly created units placed on the map.

---

## 1. High-Level Flow of Unit Recruitment

When a player (or AI) recruits a unit, the game executes the following main steps:

1. **Location Check & Selection**:
   - `check_recruit_location` in [create.cpp](file:///Users/staka/repos/wesnoth/src/actions/create.cpp#L63) finds a valid castle tile connected to a keep occupied by a leader who can recruit the chosen unit type.
2. **Unit Creation**:
   - [actions::recruit_unit](file:///Users/staka/repos/wesnoth/src/actions/create.cpp#L717) is called.
   - It instantiates a new unit object using [unit::create](file:///Users/staka/repos/wesnoth/src/units/unit.hpp#L119) with `real_unit = true`.
3. **Placing & Finalizing on Board**:
   - [actions::place_recruit](file:///Users/staka/repos/wesnoth/src/actions/create.cpp#L620) puts the unit onto the board:
     - Sets starting movement points and attacks left to 0 (since units cannot act on the turn they are recruited).
     - Fully heals the unit (`heal_fully()`).
     - Inserts the unit into the gameboard's unit map.
     - Drains gold from the side's team (`spend_gold()`).
     - Handles village capturing if the target tile is a village.
     - Fires pre-recruit and post-recruit WML/Lua events.

---

## 2. Unit Parameter Generation Process

During unit creation ([unit::create](file:///Users/staka/repos/wesnoth/src/units/unit.hpp#L119) -> [unit::init](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L789)), the following parameters are generated and computed:

### A. Gender (`gender_`)
Determined in [unit::generate_gender](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L228):
- If the gender is explicitly specified, it is used.
- Otherwise, if the unit has only one gender (or `real_unit` is false), the default gender (`genders.front()`) is used.
- If multiple genders are possible (e.g., Elvish Archer) and it is a `real_unit`, the gender is selected randomly using `randomness::generator->get_random_int(0, genders.size() - 1)`.

### B. Name (`name_`)
Generated in [unit::generate_name](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L832):
- If the unit has `real_unit = true`, a name is randomly generated based on the unit's race and gender: `race_->generate_name(gender_)`.

### C. Unique IDs (`underlying_id_` and `id_`)
Assigned in [unit::set_underlying_id](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L714):
- Generates a unique numeric ID (`underlying_id_`) using the board's `id_manager.next_id()`.
- Sets a human-readable identifier `id_` matching the format `[Unit Type]-[underlying_id]` (e.g., `Elvish Fighter-42`).

### D. Traits (`modifications_`)
Generated in [unit::generate_traits](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L841):
1. **Mandatory (Must-Have) Traits**:
   - The game checks all traits defined in the unit type's config.
   - Any traits marked as `availability = "musthave"` (such as "undead" for skeletons/liches) are automatically added to `modifications_`.
2. **Random Traits**:
   - The target number of traits is determined by `u_type.num_traits()` (usually 2).
   - Candidate traits are gathered from the unit type's possible traits:
     - Traits already possessed by the unit are excluded.
     - Traits whose requirements (`require_traits`) are not met are excluded.
     - Traits excluded by already possessed traits (`exclude_traits`) are skipped.
     - Traits requiring `availability = "any"` are the only ones allowed for leaders (recruits get traits with default/any availability).
   - Random traits are selected using `randomness::generator` and appended to `modifications_` as `[trait]` child configs.

### E. Applying Modifications & Stats Computation
Finalized in [unit::advance_to](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L1012):
1. **Base Attributes**:
   - Sets base values for hitpoints, movement, alignment, level, upkeep, and attacks from the gender/variation-adjusted `unit_type`.
2. **Modifications application**:
   - Calls [unit::apply_modifications](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L2617), which applies all children of `modifications_` (including traits).
   - Each modification is processed via [unit::add_modification](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L2488).
   - The actual adjustments to attributes (like HP, movement, attacks, adding abilities/specials) are dispatched via [unit::apply_builtin_effect](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L2057) (or Lua equivalent).
3. **Refilling Current Status**:
   - After modifications alter the maximum limits (`max_hit_points_`, `max_movement_`, `max_attacks_`), the current status variables are filled to match:
     - `movement_ = max_movement_`
     - `hit_points_ = max_hit_points_`
     - `attacks_left_ = max_attacks_`

---

## 3. Difference: Recruitment vs. Custom Map Placement (`[unit]` tag)

When a unit is created programmatically (e.g. from scenario WML or Lua via [unit_creator::add_unit](file:///Users/staka/repos/wesnoth/src/actions/unit_creator.cpp#L170)), the initialization process follows [unit::init(const config& cfg...)](file:///Users/staka/repos/wesnoth/src/units/unit.cpp#L442):
- Stats, ID, gender, name, and traits can be explicitly pre-defined in the configuration block `cfg`.
- Random traits are generated only if `cfg["random_traits"]` is not false (defaults to true).
- If the configuration defines custom `[modifications]`, those are appended before modifications/traits are applied.
- The unit retains its moves/attacks unless explicitly cleared by the creating script, unlike standard recruitment which resets them to 0.
