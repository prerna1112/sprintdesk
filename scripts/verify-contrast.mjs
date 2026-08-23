import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const minimumContrast = 4.5;

function parseTheme(selector) {
  const escapedSelector = selector.replace('.', '\\.');
  const match = css.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\n  \\}`));

  if (!match) {
    throw new Error(`Unable to find ${selector} color tokens.`);
  }

  return Object.fromEntries(
    [...match[1].matchAll(/--([\w-]+):\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%;/g)].map(
      ([, name, hue, saturation, lightness]) => [
        name,
        hslToRgb(Number(hue), Number(saturation), Number(lightness)),
      ],
    ),
  );
}

function hslToRgb(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = ((hue % 360) + 360) % 360 / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = l - chroma / 2;
  const channels =
    segment < 1 ? [chroma, secondary, 0]
      : segment < 2 ? [secondary, chroma, 0]
        : segment < 3 ? [0, chroma, secondary]
          : segment < 4 ? [0, secondary, chroma]
            : segment < 5 ? [secondary, 0, chroma]
              : [chroma, 0, secondary];

  return channels.map((channel) => channel + offset);
}

function relativeLuminance(color) {
  const [red, green, blue] = color.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05)
    / (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

function blend(foreground, background, opacity) {
  return foreground.map(
    (channel, index) => channel * opacity + background[index] * (1 - opacity),
  );
}

function requiredToken(theme, name) {
  const value = theme[name];
  if (!value) {
    throw new Error(`Missing color token --${name}.`);
  }
  return value;
}

const failures = [];

for (const [themeName, selector] of [['light', ':root'], ['dark', '.dark']]) {
  const theme = parseTheme(selector);
  // These are the base surfaces that can directly contain all semantic text
  // treatments. Muted is checked separately for the text it actually hosts.
  const containerNames = ['background', 'surface', 'elevated'];
  const pairs = [
    ['primary foreground on primary', 'primary-foreground', 'primary'],
    ['danger foreground on danger', 'danger-foreground', 'danger'],
    ['success foreground on success', 'success-foreground', 'success'],
    ['warning foreground on warning', 'warning-foreground', 'warning'],
    ['info foreground on info', 'info-foreground', 'info'],
  ];

  for (const [label, foregroundName, backgroundName] of pairs) {
    const ratio = contrastRatio(
      requiredToken(theme, foregroundName),
      requiredToken(theme, backgroundName),
    );
    if (ratio < minimumContrast) {
      failures.push(`${themeName}: ${label} is ${ratio.toFixed(2)}:1`);
    }
  }

  for (const containerName of containerNames) {
    const container = requiredToken(theme, containerName);
    const contextualPairs = [
      ['foreground', requiredToken(theme, 'foreground'), container],
      ['muted foreground', requiredToken(theme, 'muted-foreground'), container],
      ['primary text', requiredToken(theme, 'primary'), container],
      ['danger text', requiredToken(theme, 'danger'), container],
      [
        'primary hover button',
        requiredToken(theme, 'primary-foreground'),
        blend(requiredToken(theme, 'primary'), container, 0.9),
      ],
      [
        'danger hover button',
        requiredToken(theme, 'danger-foreground'),
        blend(requiredToken(theme, 'danger'), container, 0.9),
      ],
      [
        'primary text on 15% tint',
        requiredToken(theme, 'primary'),
        blend(requiredToken(theme, 'primary'), container, 0.15),
      ],
      [
        'danger text on 10% tint',
        requiredToken(theme, 'danger'),
        blend(requiredToken(theme, 'danger'), container, 0.1),
      ],
      [
        'foreground on 10% warning tint',
        requiredToken(theme, 'foreground'),
        blend(requiredToken(theme, 'warning'), container, 0.1),
      ],
      [
        'foreground on 5% primary tint',
        requiredToken(theme, 'foreground'),
        blend(requiredToken(theme, 'primary'), container, 0.05),
      ],
    ];

    for (const [label, foreground, background] of contextualPairs) {
      const ratio = contrastRatio(foreground, background);
      if (ratio < minimumContrast) {
        failures.push(`${themeName}: ${label} on ${containerName} is ${ratio.toFixed(2)}:1`);
      }
    }

    for (const priority of ['low', 'medium', 'high']) {
      const color = requiredToken(theme, `priority-${priority}`);
      const tintedBackground = blend(color, container, 0.15);
      const ratio = contrastRatio(color, tintedBackground);
      if (ratio < minimumContrast) {
        failures.push(
          `${themeName}: ${priority} priority badge on ${containerName} is ${ratio.toFixed(2)}:1`,
        );
      }
    }
  }

  const muted = requiredToken(theme, 'muted');
  for (const [label, foreground] of [
    ['foreground on muted', requiredToken(theme, 'foreground')],
    ['muted foreground on muted', requiredToken(theme, 'muted-foreground')],
  ]) {
    const ratio = contrastRatio(foreground, muted);
    if (ratio < minimumContrast) {
      failures.push(`${themeName}: ${label} is ${ratio.toFixed(2)}:1`);
    }
  }
}

if (failures.length > 0) {
  throw new Error(`WCAG AA contrast verification failed:\n${failures.join('\n')}`);
}

console.log('WCAG AA contrast verification passed for semantic text color pairs.');
