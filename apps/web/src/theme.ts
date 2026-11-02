import type { ThemeConfig } from 'antd';

/** Orbit brand palette. See the Brand guide page (/brand) for usage. */
export const brand = {
  violet: '#6D5DFC', // Orbit Violet: primary actions, links, the mark
  purple: '#A855F7', // Nebula Purple: middle of the brand gradient
  pink: '#F472B6', // Comet Pink: end of the gradient, highlights
  cyan: '#22D3EE', // Satellite Cyan: tiny accents only (the satellite, live indicators)
  space: '#0B0A1F', // Deep Space: dark surfaces and the wordmark
  stardust: '#F6F6F9', // Stardust: app background
  gradient: 'linear-gradient(135deg, #6D5DFC 0%, #A855F7 55%, #F472B6 100%)',
};

// Design tokens. Keep in sync with the CSS variables in styles.css.
export const colors = {
  primary: '#6D5DFC',
  bg: '#F6F6F9',
  surface: '#FFFFFF',
  border: '#EBEBF0',
  text: '#18181B',
  muted: '#71717A',
};

/** Soft background + strong foreground pairs for icon chips and avatars. */
export const tones = {
  violet: { bg: '#F0EEFF', fg: '#6D5DFC' },
  green: { bg: '#E8F8EF', fg: '#16A34A' },
  amber: { bg: '#FFF4E5', fg: '#D97706' },
  blue: { bg: '#E8F1FF', fg: '#2563EB' },
  pink: { bg: '#FDECF3', fg: '#DB2777' },
  teal: { bg: '#E6F7F6', fg: '#0D9488' },
};
export type Tone = keyof typeof tones;

export const theme: ThemeConfig = {
  token: {
    colorPrimary: colors.primary,
    colorInfo: colors.primary,
    colorText: colors.text,
    colorTextSecondary: colors.muted,
    colorBorder: '#E4E4E9',
    colorBorderSecondary: colors.border,
    colorBgLayout: colors.bg,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    borderRadius: 10,
    borderRadiusLG: 16,
    controlHeight: 36,
    boxShadowTertiary: '0 1px 2px rgba(16, 24, 40, 0.04)',
  },
  components: {
    Layout: { headerBg: 'transparent', siderBg: colors.surface, bodyBg: colors.bg, headerPadding: '0 32px', headerHeight: 68 },
    Menu: {
      itemBorderRadius: 10,
      itemHeight: 38,
      itemMarginInline: 12,
      itemSelectedBg: '#F0EEFF',
      itemSelectedColor: colors.primary,
      itemColor: '#52525B',
      itemHoverBg: '#F4F4F6',
      groupTitleColor: '#A1A1AA',
      groupTitleFontSize: 11,
      iconSize: 16,
    },
    Card: { headerFontSize: 15, paddingLG: 20 },
    Table: { headerBg: '#FAFAFB', headerColor: colors.muted, rowHoverBg: '#FAFAFE', headerSplitColor: 'transparent', cellPaddingBlock: 14 },
    Button: { fontWeight: 500, primaryShadow: '0 1px 2px rgba(109, 93, 252, 0.3)', defaultShadow: 'none' },
    Statistic: { contentFontSize: 28, titleFontSize: 13 },
    Tabs: { titleFontSize: 14 },
    Modal: { titleFontSize: 18 },
  },
};
