/**
 * UI-FE-089 — Icon registry contract tests.
 *
 * Verifies that the approved catalogue, the dynamic glyph map, and the
 * reserved status semantics stay in sync, and that every registered icon is
 * documented with a semantic name.
 */

import {
  ICON_CATALOGUE,
  ICON_CATEGORIES,
  ICON_NAMES,
  STATUS_ICON_NAMES,
  getIconDefinition,
  getStatusIconName,
  isIconName,
} from '@/components/ui/icons/catalogue';
import { ICON_COMPONENTS, getIconComponent } from '@/components/ui/icons/icon-map';
import { STATUS_TONES } from '@/lib/design-tokens';

describe('icon catalogue', () => {
  it('exposes a non-empty, unique vocabulary', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(0);
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  it('documents exactly the registered vocabulary', () => {
    expect(Object.keys(ICON_CATALOGUE).sort()).toEqual([...ICON_NAMES].sort());
  });

  it.each(ICON_NAMES)('documents "%s" with a semantic meaning', (name) => {
    const definition = getIconDefinition(name);
    expect(definition.name).toBe(name);
    expect(definition.label.trim()).not.toBe('');
    expect(definition.semantics.trim().length).toBeGreaterThan(10);
    expect(ICON_CATEGORIES).toContain(definition.category);
  });

  it('maps every registered name to a concrete glyph', () => {
    for (const name of ICON_NAMES) {
      expect(ICON_COMPONENTS[name]).toBeDefined();
      expect(getIconComponent(name)).toBe(ICON_COMPONENTS[name]);
    }
  });

  it('does not ship glyphs for unregistered names', () => {
    expect(Object.keys(ICON_COMPONENTS).sort()).toEqual([...ICON_NAMES].sort());
  });

  it('recognises registered names and rejects unknown ones', () => {
    expect(isIconName('shield')).toBe(true);
    expect(isIconName('definitely-not-an-icon')).toBe(false);
  });
});

describe('reserved status semantics', () => {
  it('reserves exactly one approved glyph for every status tone', () => {
    expect(Object.keys(STATUS_ICON_NAMES).sort()).toEqual([...STATUS_TONES].sort());
    for (const tone of STATUS_TONES) {
      const iconName = getStatusIconName(tone);
      expect(ICON_NAMES).toContain(iconName);
      expect(getIconDefinition(iconName).category).toBe('status');
    }
  });

  it('keeps confirmed/success on the same glyph and warning/danger on the same glyph', () => {
    expect(STATUS_ICON_NAMES.confirmed).toBe(STATUS_ICON_NAMES.success);
    expect(STATUS_ICON_NAMES.warning).toBe(STATUS_ICON_NAMES.danger);
  });
});
