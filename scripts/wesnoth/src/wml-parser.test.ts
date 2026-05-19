import { test, describe } from 'node:test';
import assert from 'node:assert';
import { parseWml, WmlNode, MacroDictionary } from './wml-parser.js';

describe('parseWml - Structural Tests', () => {
  test('parses basic tags and properties', () => {
    const wml = `
[unit]
  id=Elvish Fighter
  name="Elvish Fighter"
[/unit]
    `;
    const root = parseWml(wml);
    assert.strictEqual(root.tag, 'root');
    assert.strictEqual(root.children.length, 1);

    const unit = root.children[0];
    assert.strictEqual(unit.tag, 'unit');
    assert.strictEqual(unit.attributes.id, 'Elvish Fighter');
    assert.strictEqual(unit.attributes.name, 'Elvish Fighter');
  });

  test('parses nested tags', () => {
    const wml = `
[unit]
  [attack]
    name=sword
    damage=5
  [/attack]
[/unit]
    `;
    const root = parseWml(wml);
    assert.strictEqual(root.children.length, 1);

    const unit = root.children[0];
    assert.strictEqual(unit.tag, 'unit');
    assert.strictEqual(unit.children.length, 1);

    const attack = unit.children[0];
    assert.strictEqual(attack.tag, 'attack');
    assert.strictEqual(attack.attributes.name, 'sword');
    assert.strictEqual(attack.attributes.damage, '5');
  });

  test('handles merge syntax [+tag]', () => {
    const wml = `
[unit]
  [attack]
    name=sword
  [/attack]
  [+attack]
    damage=5
  [/attack]
[/unit]
    `;
    const root = parseWml(wml);

    const unit = root.children[0];
    assert.strictEqual(unit.children.length, 1); // Should merge into the first [attack]

    const attack = unit.children[0];
    assert.strictEqual(attack.tag, 'attack');
    assert.strictEqual(attack.attributes.name, 'sword');
    assert.strictEqual(attack.attributes.damage, '5');
  });
});

describe('parseWml - String Handling and Comments', () => {
  test('skips single-line and inline comments', () => {
    const wml = `
# This is a comment
[unit]
  id=Orc # Inline comment
  # Another comment
[/unit]
    `;
    const root = parseWml(wml);
    assert.strictEqual(root.children.length, 1);

    const unit = root.children[0];
    assert.strictEqual(unit.attributes.id, 'Orc');
  });

  test('handles translation markers', () => {
    const wml = `
[unit]
  name=_ "Orcish Grunt"
[/unit]
    `;
    const root = parseWml(wml);

    const unit = root.children[0];
    assert.strictEqual(unit.attributes.name, 'Orcish Grunt');
  });

  test('handles string concatenation', () => {
    const wml = `
[unit]
  description=_ "A fierce " + "warrior" + _ " of the orcs."
[/unit]
    `;
    const root = parseWml(wml);

    const unit = root.children[0];
    assert.strictEqual(
      unit.attributes.description,
      'A fierce warrior of the orcs.',
    );
  });

  test('handles multi-line strings with unclosed quotes', () => {
    const wml = `
[unit]
  description="This is a
multi-line
string."
[/unit]
    `;
    const root = parseWml(wml);

    const unit = root.children[0];
    assert.strictEqual(
      unit.attributes.description,
      'This is a\nmulti-line\nstring.',
    );
  });
});

describe('parseWml - Macros', () => {
  test('defines and undefines macros', () => {
    const wml = `
#define MY_MACRO
  damage=10
#enddef
[unit]
  {MY_MACRO}
[/unit]
#undef MY_MACRO
[unit]
  {MY_MACRO}
[/unit]
    `;
    const dict: MacroDictionary = new Map();
    const root = parseWml(wml, dict);

    assert.strictEqual(root.children.length, 2);

    const unit1 = root.children[0];
    assert.strictEqual(unit1.attributes.damage, '10');
    assert.strictEqual(unit1.macros.length, 0); // Expanded

    const unit2 = root.children[1];
    assert.strictEqual(unit2.attributes.damage, undefined);
    assert.strictEqual(unit2.macros.length, 1);
    assert.strictEqual(unit2.macros[0], 'MY_MACRO'); // Not expanded, since undefined
  });

  test('handles parameterized macros', () => {
    const wml = `
#define WEAPON NAME DAMAGE
  [attack]
    name={NAME}
    damage={DAMAGE}
  [/attack]
#enddef
[unit]
  {WEAPON sword 5}
  {WEAPON (long bow) 8}
[/unit]
    `;
    const dict: MacroDictionary = new Map();
    const root = parseWml(wml, dict);

    const unit = root.children[0];
    assert.strictEqual(unit.children.length, 2);

    const attack1 = unit.children[0];
    assert.strictEqual(attack1.tag, 'attack');
    assert.strictEqual(attack1.attributes.name, 'sword');
    assert.strictEqual(attack1.attributes.damage, '5');

    const attack2 = unit.children[1];
    assert.strictEqual(attack2.tag, 'attack');
    assert.strictEqual(attack2.attributes.name, 'long bow');
    assert.strictEqual(attack2.attributes.damage, '8');
  });

  test('expands constant macros inline', () => {
    const wml = `
#define MAX_HP
50#enddef
[unit]
  hitpoints={MAX_HP}
[/unit]
    `;
    const dict: MacroDictionary = new Map();
    const root = parseWml(wml, dict);

    const unit = root.children[0];
    assert.strictEqual(unit.attributes.hitpoints, '50');
  });

  test('records inline macros when no dictionary matches', () => {
    const wml = `
[unit]
  {SOME_INLINE_MACRO}
[/unit]
    `;
    const root = parseWml(wml); // No dict passed

    const unit = root.children[0];
    assert.strictEqual(unit.macros.length, 1);
    assert.strictEqual(unit.macros[0], 'SOME_INLINE_MACRO');
  });
});

describe('parseWml - Python Parser Compatibility Features', () => {
  test('handles multi-assign syntax (a, b = 1, 2)', () => {
    const wml = `
[test]
  a, b, c = 1, "2, 3", 4
  x, y = 10
[/test]
    `;
    const root = parseWml(wml);
    const testTag = root.children[0];
    assert.strictEqual(testTag.attributes.a, '1');
    assert.strictEqual(testTag.attributes.b, '2, 3');
    assert.strictEqual(testTag.attributes.c, '4');
    assert.strictEqual(testTag.attributes.x, '10');
    assert.strictEqual(testTag.attributes.y, '');
  });

  test('handles heredoc syntax (<< ... >>)', () => {
    const wml = `
[test]
  code = <<
    "quotes" here
    ""blah""
>>
[/test]
    `;
    const root = parseWml(wml);
    const testTag = root.children[0];
    assert.strictEqual(testTag.attributes.code, '"quotes" here\n    ""blah""');
  });

  test('handles line-ending + continuation', () => {
    const wml = `
[test]
  foo = "bar" +
    "baz"
[/test]
    `;
    const root = parseWml(wml);
    const testTag = root.children[0];
    assert.strictEqual(testTag.attributes.foo, 'barbaz');
  });
});
