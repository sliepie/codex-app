const STYLE_ID = "codex-app-ui-overrides-style";

const HIDDEN_DISPLAY_DECLARATIONS = "display:none!important;";
const USAGE_MENU_CONTENT_CLASS_SELECTOR = ".flex.flex-col.text-sm";
const USAGE_MENU_RATE_ROWS_CLASS_SELECTOR =
  ".grid.items-center.gap-y-1\\.5.py-1";
const USAGE_MENU_CONTENT_SELECTOR =
  `${USAGE_MENU_CONTENT_CLASS_SELECTOR}:has(>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR})`;
const USAGE_MENU_SUBMENU_SELECTOR =
  `div.flex.flex-col[data-state]:has(>div:last-child>div.overflow-hidden>${USAGE_MENU_CONTENT_CLASS_SELECTOR}>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR})`;
const USAGE_MENU_TRIGGER_SELECTOR =
  `${USAGE_MENU_SUBMENU_SELECTOR}>:first-child`;
const USAGE_MENU_TRIGGER_CONTENT_SELECTOR =
  `${USAGE_MENU_TRIGGER_SELECTOR}>div`;
const USAGE_MENU_TRIGGER_CHEVRON_SELECTOR =
  `${USAGE_MENU_TRIGGER_CONTENT_SELECTOR}>span[aria-hidden='true']`;
const USAGE_MENU_RATE_ROWS_SELECTOR =
  `${USAGE_MENU_CONTENT_SELECTOR}>${USAGE_MENU_RATE_ROWS_CLASS_SELECTOR}`;
const USAGE_MENU_RATE_LABEL_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}>span.font-medium`;
const USAGE_MENU_RATE_ROWS_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 3px)!important;padding-right:var(--padding-row-x)!important;";
const USAGE_MENU_RESET_ACTION_DECLARATIONS =
  "padding-left:calc(var(--padding-row-x) + 1.25rem + 2px)!important;padding-right:var(--padding-row-x)!important;font-weight:400!important;";
const USAGE_MENU_LABEL_DECLARATIONS = "font-weight:400!important;";
const USAGE_MENU_LINK_DECLARATIONS = "display:none!important;";
const USAGE_MENU_TRIGGER_DECLARATIONS =
  "pointer-events:none!important;cursor:default!important;background-color:transparent!important;visibility:hidden!important;";
const USAGE_MENU_TRIGGER_CONTENT_DECLARATIONS =
  "visibility:visible!important;";
const USAGE_MENU_RESET_ACTION_SELECTOR =
  `${USAGE_MENU_RATE_ROWS_SELECTOR}~:is(div,button,[role='menuitem']):not(a[href]):has(svg)`;
const INVITE_FRIEND_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.0368 1.69459'])";
const PET_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M12.8124 13.516'])";
const GIFT_CREDITS_MENU_ITEM_SELECTOR =
  ":where([role='menu'],[data-radix-popper-content-wrapper]) [role='menuitem']:has(svg path[d^='M3.333 8.333h13.334v8.334H3.333V8.333Z'])";
const PROFILE_MENU_IDENTITY_SELECTOR =
  "[role='menuitem'] svg path[d^='M10.6391 1.67517']";
const PROFILE_MENU_SELECTOR =
  `:where([role='menu']):has(${PROFILE_MENU_IDENTITY_SELECTOR})`;
const PROFILE_MENU_DECLARATIONS =
  "width:calc(var(--radix-dropdown-menu-trigger-width,var(--radix-popper-anchor-width)) - 2px)!important;";

// Sidebar task rows: compact every task row and vertically center its title in Projects,
// Pinned, and Chats without changing the native selected-row background.
const SIDEBAR_ROOT_SELECTOR =
  ':where(aside,nav,[role="navigation"]):has([data-app-action-sidebar-section-heading])';
const SIDEBAR_ROOT_DECLARATIONS =
  "--sidebar-scroll-header-spacing:1px!important;";
const SIDEBAR_COMPACT_THREAD_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-thread-row]`;
const SIDEBAR_COMPACT_THREAD_ROW_DECLARATIONS =
  "height:calc(var(--height-token-row) - 4px)!important;";
// Keep overflowing titles stationary while preserving OAI's native right-edge fade.
// The renderer now uses data-marquee-* descendants instead of the former
// data-thread-title-scrolling/data-thread-title-overflowing attributes.
const SIDEBAR_THREAD_TITLE_SCROLL_TRACK_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-thread-title][data-marquee-text] span:has(>[data-marquee-content])`;
const SIDEBAR_THREAD_TITLE_SCROLL_TRACK_DECLARATIONS =
  "animation:none!important;transform:none!important;transition:none!important;";
const SIDEBAR_THREAD_TITLE_SCROLL_COPY_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-thread-title][data-marquee-text] [data-marquee-copy]`;
const SIDEBAR_OVERFLOWING_THREAD_TITLE_ON_HOVER_SELECTOR =
  `${SIDEBAR_COMPACT_THREAD_ROW_SELECTOR}:hover [data-thread-title][data-marquee-text][data-marquee-overflowing]`;
const SIDEBAR_OVERFLOWING_THREAD_TITLE_ON_HOVER_DECLARATIONS =
  "-webkit-mask-image:linear-gradient(to right,#000 calc(100% - var(--text-fade-truncate-distance,1rem)),transparent)!important;mask-image:linear-gradient(to right,#000 calc(100% - var(--text-fade-truncate-distance,1rem)),transparent)!important;";
const SIDEBAR_THREAD_ROW_HOVER_SELECTOR =
  `${SIDEBAR_COMPACT_THREAD_ROW_SELECTOR}:hover`;
const SIDEBAR_THREAD_ROW_HOVER_DECLARATIONS =
  "background-color:var(--color-token-list-hover-background)!important;";
const SIDEBAR_OTHER_SURFACE_HOVER_SELECTOR = [
  `${SIDEBAR_ROOT_SELECTOR} [class~='sidebar-item']:hover`,
];
const SIDEBAR_OTHER_SURFACE_HOVER_DECLARATIONS =
  SIDEBAR_THREAD_ROW_HOVER_DECLARATIONS;
// Sidebar rich hover cards are body-level portals. Hide that portal for the whole
// hovered sidebar surface so it cannot flicker between task and project rows, but
// preserve a rich tooltip opened by keyboard focus outside the sidebar.
const SIDEBAR_HOVER_CARD_SURFACE_SELECTOR =
  "[data-app-action-sidebar-scroll]:hover";
const SIDEBAR_OUTSIDE_FOCUS_VISIBLE_SELECTOR =
  `:focus-visible:not(${SIDEBAR_ROOT_SELECTOR} *)`;
const SIDEBAR_HOVER_CARD_SELECTOR =
  `body:has(${SIDEBAR_HOVER_CARD_SURFACE_SELECTOR}):not(:has(${SIDEBAR_OUTSIDE_FOCUS_VISIBLE_SELECTOR})) [role='tooltip'][class~='rounded-xl'][class~='backdrop-blur-sm']`;
// OAI renders pin/archive in an absolute 52px rail. Use the button-bearing selector
// only to style that rail directly; use the class-only selector inside the row-level
// :has(), because nesting the button selector's :has() would invalidate the CSS.
const SIDEBAR_THREAD_ROW_ACTION_RAIL_PATH_SELECTOR =
  "[class~='absolute'][class~='right-0'][class~='top-0'][class~='z-10'][class~='h-full'][class~='w-[52px]']:has(button.sidebar-hover-icon-button-tint)";
const SIDEBAR_THREAD_ROW_ACTION_RAIL_BOX_SELECTOR =
  "[class~='absolute'][class~='right-0'][class~='top-0'][class~='z-10'][class~='h-full'][class~='w-[52px]'][class~='opacity-0'][class~='group-hover:opacity-100']";
const SIDEBAR_THREAD_ROW_WITH_ACTION_RAIL_SELECTOR =
  `${SIDEBAR_COMPACT_THREAD_ROW_SELECTOR}:is(:hover,:focus-within):has(${SIDEBAR_THREAD_ROW_ACTION_RAIL_BOX_SELECTOR})`;
const SIDEBAR_THREAD_ROW_ACTION_RAIL_SELECTOR =
  `${SIDEBAR_COMPACT_THREAD_ROW_SELECTOR}:is(:hover,:focus-within) ${SIDEBAR_THREAD_ROW_ACTION_RAIL_PATH_SELECTOR}`;
const SIDEBAR_THREAD_ROW_ACTION_RAIL_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const SIDEBAR_THREAD_ROW_SPACER_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem'][class~='after:h-px']:has([data-app-action-sidebar-thread-row])`;
const SIDEBAR_THREAD_ROW_BORDER_DECLARATIONS =
  "box-sizing:border-box!important;border-bottom:1px solid transparent!important;background-clip:padding-box!important;";
// The sidebar list renderer wraps each thread row in a Framer Motion
// overflow-hidden element for archive enter/exit transitions. Force the
// settled layout values so archiving removes the row without a fade/height
// animation.
const SIDEBAR_THREAD_ARCHIVE_MOTION_SELECTOR = [
  `${SIDEBAR_ROOT_SELECTOR} [class~='overflow-hidden']:has(>[role='listitem'] [data-app-action-sidebar-thread-row])`,
  `${SIDEBAR_ROOT_SELECTOR} [class~='overflow-hidden']:has(>[data-app-action-sidebar-thread-row])`,
];
const SIDEBAR_THREAD_ARCHIVE_MOTION_DECLARATIONS =
  "height:auto!important;opacity:1!important;overflow:visible!important;transition:none!important;animation:none!important;";
// Project-local thread rows are additionally wrapped by dnd-kit, which puts
// an inline transition on the listitem when neighboring rows are removed.
const SIDEBAR_THREAD_DND_ITEM_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has([data-app-action-sidebar-thread-row])`;
const SIDEBAR_THREAD_DND_ITEM_DECLARATIONS =
  "transition:none!important;animation:none!important;";
// Project/connection groups are separate dnd-kit listitems. Their inline
// transitions make the groups below visibly bounce when one project closes.
const SIDEBAR_GROUP_DND_ITEM_SELECTOR = [
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem'][data-sidebar-project-kind]`,
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem'][class~='group/cwd']`,
];
const SIDEBAR_GROUP_DND_ITEM_DECLARATIONS =
  "transition:none!important;animation:none!important;";
// Replace the overlapping PR/progress rail with actions, reserve exactly the action
// width for title fading, and remove OAI's now-hidden variable-width status spacer.
const SIDEBAR_THREAD_ROW_FLOATING_STATUS_WITH_ACTIONS_SELECTOR =
  `${SIDEBAR_THREAD_ROW_WITH_ACTION_RAIL_SELECTOR}>[data-hover-card-open-immediately][class~='absolute'][class~='right-0'][class~='top-0'][class~='z-10'][class~='h-full'][class~='min-w-[52px]']`;
const SIDEBAR_THREAD_ROW_ACTION_SLOT_SELECTOR =
  `${SIDEBAR_THREAD_ROW_WITH_ACTION_RAIL_SELECTOR}>[class~='flex'][class~='h-full'][class~='w-full'][class~='items-center']>[class~='ml-[3px]'][class~='flex'][class~='items-center'][class~='justify-end'][class~='gap-1']`;
const SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS =
  "min-width:52px!important;";
const SIDEBAR_THREAD_ROW_STATUS_SPACER_WITH_ACTIONS_SELECTOR =
  `${SIDEBAR_THREAD_ROW_WITH_ACTION_RAIL_SELECTOR}>[class~='flex'][class~='h-full'][class~='w-full'][class~='items-center']>[class~='shrink-0']:last-child:empty`;

// Project rows: compact project headers and nested-list spacing while retaining overflow
// needed by the native project controls.
const SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-project-row]`;
const SIDEBAR_COMPACT_PROJECT_ROW_DECLARATIONS =
  "height:calc(var(--height-token-row) - 2px)!important;overflow-y:hidden!important;";
const SIDEBAR_COMPACT_PROJECT_CONTENT_SELECTOR =
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR} [class~="text-base"][class~="py-1"]`;
const SIDEBAR_COMPACT_PROJECT_CONTENT_DECLARATIONS =
  "padding-block:calc(var(--spacing) - 1px)!important;";
const SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has([data-app-action-sidebar-project-row]) [class~='pt-0.5'][class~='pb-2']:has([role='listitem'][class~='flex'][class~='gap-1'][class~='py-1']>button)`;
const SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_DECLARATIONS =
  "padding-bottom:0!important;";
// Q7l renders project children in an overflow-hidden Framer Motion wrapper.
// Keep the expanded layout at its final state; when the verified project-row
// marker says it is collapsed, remove that wrapper from layout immediately.
const SIDEBAR_PROJECT_CONTENT_PARENT_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([role='listitem'],[class~='flex'][class~='flex-col']):has(>[data-app-action-sidebar-project-row])`;
const SIDEBAR_PROJECT_CONTENT_MOTION_SELECTOR =
  `${SIDEBAR_PROJECT_CONTENT_PARENT_SELECTOR}>[class~='overflow-hidden']:has(>[class~='pt-0.5'][class~='pb-2'])`;
const SIDEBAR_PROJECT_CONTENT_MOTION_DECLARATIONS =
  "height:auto!important;opacity:1!important;overflow:visible!important;transition:none!important;animation:none!important;";
const SIDEBAR_COLLAPSED_PROJECT_CONTENT_MOTION_SELECTOR =
  `${SIDEBAR_PROJECT_CONTENT_PARENT_SELECTOR}:has(>[data-app-action-sidebar-project-row][data-app-action-sidebar-project-collapsed='true'])>[class~='overflow-hidden']:has(>[class~='pt-0.5'][class~='pb-2'])`;
const SIDEBAR_COLLAPSED_PROJECT_CONTENT_MOTION_DECLARATIONS =
  "display:none!important;";
// Remote/project groups use the same Framer Motion overflow wrapper, but their
// content only has the pt-0.5 marker. Keep that alternate wrapper settled too.
const SIDEBAR_GROUP_CONTENT_MOTION_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [class~='overflow-hidden']:has(>[class~='pt-0.5'])`;
const SIDEBAR_GROUP_CONTENT_MOTION_DECLARATIONS =
  SIDEBAR_PROJECT_CONTENT_MOTION_DECLARATIONS;
const SIDEBAR_COLLAPSED_GROUP_CONTENT_MOTION_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has(>[role='button'][aria-expanded='false'])>[class~='overflow-hidden']:has(>[class~='pt-0.5'])`;
const SIDEBAR_COLLAPSED_GROUP_CONTENT_MOTION_DECLARATIONS =
  SIDEBAR_COLLAPSED_PROJECT_CONTENT_MOTION_DECLARATIONS;
const SIDEBAR_PROJECT_TITLE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-project-row] span.text-fade-truncate.pr-1`;
const SIDEBAR_PROJECT_TITLE_DECLARATIONS =
  "transform:translateY(-1px)!important;";
const SIDEBAR_NAV_ROW_SHELL_SELECTOR =
  ":is(button,div)[class~='relative'][class~='h-[var(--height-token-row)]'][class~='py-row-y']";
const SIDEBAR_PRIMARY_NAV_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR}>[class~='relative'][class~='z-10'][class~='shrink-0'][class~='flex-col'][class~='gap-2'][class~='px-row-x'] ${SIDEBAR_NAV_ROW_SHELL_SELECTOR}`;
const SIDEBAR_NAV_ROW_SELECTOR = [
  SIDEBAR_PRIMARY_NAV_ROW_SELECTOR,
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-scroll]>[class~='flex'][class~='shrink-0'][class~='flex-col'][class~='gap-2'] ${SIDEBAR_NAV_ROW_SHELL_SELECTOR}`,
];
const SIDEBAR_NAV_ROW_DECLARATIONS =
  "height:calc(var(--height-token-row) - 4px)!important;";
const SIDEBAR_PRIMARY_NAV_ACTION_SELECTOR =
  `${SIDEBAR_PRIMARY_NAV_ROW_SELECTOR}[class~='group']:is(:hover,:focus-within)>[class~='pointer-events-none'][class~='shrink-0'][class~='opacity-0']`;
const SIDEBAR_PRIMARY_NAV_ACTION_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;";
const SIDEBAR_NAV_LEADING_ICON_SELECTOR = SIDEBAR_NAV_ROW_SELECTOR.flatMap(
  (selector) => [
    `${selector}>.flex.min-w-0.items-center.text-base.gap-2>span.flex.w-4.shrink-0`,
    `${selector}>button>.flex.min-w-0.items-center.text-base.gap-2>span.flex.w-4.shrink-0`,
  ],
);
const SIDEBAR_PROJECT_LEADING_ICON_SELECTOR =
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR} [data-sidebar-project-drop-zone='project-icon'] > :first-child`;
const SIDEBAR_LEADING_ICON_DECLARATIONS = "translate:-1px 0!important;";

// Project row controls: restore OAI's menu/new-task controls for hover, focus, and the
// project containing the active task. These selectors must not target task-row controls.
const SIDEBAR_ACTIVE_PROJECT_ROW_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [role='listitem']:has([data-app-action-sidebar-project-row]):has([data-app-action-sidebar-thread-active='true']) [data-app-action-sidebar-project-row]`;
const SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS = [
  `${SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR}:is(:hover,:focus-within,[aria-current='page'])`,
  SIDEBAR_ACTIVE_PROJECT_ROW_SELECTOR,
];
const SIDEBAR_PROJECT_ROW_ACTION_SELECTOR =
  SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS.map(
    (selector) =>
      `${selector} [class~='col-start-1'][class~='row-start-1'][class~='inline-flex'][class~='justify-self-end']:has(button)`,
  );
const SIDEBAR_PROJECT_ROW_ACTION_ICON_SELECTOR =
  SIDEBAR_PROJECT_ROW_ACTION_SELECTOR.map((selector) => `${selector} svg`);
const SIDEBAR_PROJECT_ROW_ACTION_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;";
const SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS =
  "opacity:1!important;visibility:visible!important;color:var(--color-token-foreground,currentColor)!important;";
const SIDEBAR_PROJECT_ROW_MENU_SELECTOR =
  SIDEBAR_INTERACTIVE_PROJECT_ROW_SELECTORS.map(
    (selector) =>
      `${selector} [class~='w-0'][class~='overflow-hidden'][class~='opacity-0']:has(button[aria-haspopup='menu'])`,
  );
const SIDEBAR_PROJECT_ROW_MENU_ICON_SELECTOR =
  SIDEBAR_PROJECT_ROW_MENU_SELECTOR.map((selector) => `${selector} svg`);
const SIDEBAR_PROJECT_ROW_MENU_DECLARATIONS =
  "width:auto!important;overflow:visible!important;opacity:1!important;visibility:visible!important;";
const SIDEBAR_PROJECT_ROW_MENU_INSET_SELECTOR =
  SIDEBAR_PROJECT_ROW_MENU_SELECTOR.map(
    (selector) => `${selector} [class~='pr-0.5']:has(button[aria-haspopup='menu'])`,
  );
const SIDEBAR_PROJECT_ROW_MENU_INSET_DECLARATIONS = "padding-right:0!important;";

// Section headers: keep header actions visible without applying row hover backgrounds,
// and keep Projects, Pinned, Chats, and Tasks expanded. The renderer has emitted
// both Chats and Recents markers across supported builds.
const SIDEBAR_SECTION_ACTIONS_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-section-heading] [class~="group/nav-section-title"] [class~="pointer-events-none"][class~="opacity-0"]`;
const SIDEBAR_SECTION_ACTIONS_DECLARATIONS =
  "opacity:1!important;pointer-events:auto!important;";
const SIDEBAR_RECENT_CHATS_SECTION_MARKER_SELECTOR =
  ':is([data-app-action-sidebar-section-heading="Chats"],[data-app-action-sidebar-section-heading="Recents"])';
const SIDEBAR_SECTION_CONTENT_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([data-app-action-sidebar-section-heading="Projects"],[data-app-action-sidebar-section-heading="Pinned"],${SIDEBAR_RECENT_CHATS_SECTION_MARKER_SELECTOR},[data-app-action-sidebar-section-heading="Tasks"])>[class~='flex'][class~='flex-col']>[class~="group/nav-section-title"]+[class~='overflow-hidden']>[class~='flex'][class~='flex-col'][class~='gap-px'][class~='pt-1']`;
const SIDEBAR_SECTION_CONTENT_DECLARATIONS = "padding-top:0!important;";
const SIDEBAR_SECTION_TOGGLE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([data-app-action-sidebar-section-heading="Projects"],[data-app-action-sidebar-section-heading="Pinned"],${SIDEBAR_RECENT_CHATS_SECTION_MARKER_SELECTOR},[data-app-action-sidebar-section-heading="Tasks"]) [data-app-action-sidebar-section-toggle]`;
const SIDEBAR_SECTION_TOGGLE_DECLARATIONS =
  "pointer-events:none!important;cursor:default!important;";
const SIDEBAR_OFFSET_SECTION_TITLE_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} :is([data-app-action-sidebar-section-heading="Projects"],[data-app-action-sidebar-section-heading="Pinned"]) [data-app-action-sidebar-section-toggle]`;
const SIDEBAR_OFFSET_SECTION_TITLE_DECLARATIONS = "translate:-1px 0!important;";
const SIDEBAR_SECTION_TOGGLE_ICON_SELECTOR =
  `${SIDEBAR_SECTION_TOGGLE_SELECTOR}>[class~="opacity-0"]`;
const SIDEBAR_SECTION_TOGGLE_ICON_TRANSITION_SELECTOR =
  `${SIDEBAR_SECTION_TOGGLE_SELECTOR} [class~='transition-transform']`;
const SIDEBAR_SECTION_TOGGLE_ICON_TRANSITION_DECLARATIONS =
  "transition:none!important;animation:none!important;";
// Cuu animates the disclosure icon with an inline Framer Motion `rotate` value.
// Override that inline value per final aria-expanded state so the icon does not
// visibly rotate while the group content is being expanded or collapsed.
const SIDEBAR_FOLDER_TOGGLE_MOTION_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} button.sidebar-hover-icon-tint[aria-expanded]>[class~='flex'][class~='items-center']`;
const SIDEBAR_FOLDER_TOGGLE_MOTION_DECLARATIONS =
  "rotate:0deg!important;transform:none!important;transition:none!important;animation:none!important;";
const SIDEBAR_EXPANDED_FOLDER_TOGGLE_ICON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} button.sidebar-hover-icon-tint[aria-expanded='true']>[class~='flex'][class~='items-center']>svg`;
const SIDEBAR_EXPANDED_FOLDER_TOGGLE_ICON_DECLARATIONS =
  "rotate:90deg!important;transform:rotate(90deg)!important;transition:none!important;animation:none!important;";
const SIDEBAR_HEADER_SELECTOR =
  'nav[role="navigation"]>.relative.z-10.flex.shrink-0.flex-col.gap-2 .ms-2.flex.items-center.pe-1';
const SIDEBAR_HEADER_MODE_SELECTOR =
  `${SIDEBAR_HEADER_SELECTOR}>:first-child`;
const SIDEBAR_HEADER_ACTIONS_SELECTOR =
  `${SIDEBAR_HEADER_SELECTOR}>.ms-auto.flex.items-center.gap-1`;
const SIDEBAR_HEADER_ACTIONS_DECLARATIONS =
  "position:fixed!important;inset-inline-start:calc(var(--spacing-token-safe-header-left) + 3 * var(--spacing-token-button-composer))!important;top:var(--spacing)!important;z-index:44!important;height:var(--height-toolbar-sm)!important;display:flex!important;align-items:center!important;gap:0!important;pointer-events:auto!important;-webkit-app-region:no-drag!important;";
const SIDEBAR_HEADER_ACTION_BUTTONS_SELECTOR =
  `${SIDEBAR_HEADER_ACTIONS_SELECTOR} button`;
const SIDEBAR_HEADER_ACTION_BUTTONS_DECLARATIONS =
  "box-sizing:border-box!important;width:var(--spacing-token-button-composer)!important;height:var(--spacing-token-button-composer)!important;min-width:var(--spacing-token-button-composer)!important;min-height:var(--spacing-token-button-composer)!important;max-width:var(--spacing-token-button-composer)!important;max-height:var(--spacing-token-button-composer)!important;flex:0 0 var(--spacing-token-button-composer)!important;padding:0!important;margin:0!important;border-radius:var(--radius-lg)!important;corner-shape:var(--codex-corner-shape)!important;transform:none!important;";
// The native toolbar uses icon-xs (16px), while size=icon adds the Electron
// icon-sm (18px) child rule to the migrated search/activity controls.
const SIDEBAR_HEADER_ACTION_ICON_SELECTOR =
  `${SIDEBAR_HEADER_ACTIONS_SELECTOR} button>svg`;
const SIDEBAR_HEADER_ACTION_ICON_DECLARATIONS =
  "width:calc(var(--spacing) * 4)!important;height:calc(var(--spacing) * 4)!important;transform:translateY(1px)!important;";
// The attention variant changes the bell outline as well as adding the native
// badge. Reuse the exact normal D8l path from the renderer so removing the
// attention state restores the same bell geometry without a runtime DOM rewrite.
const SIDEBAR_ACTIVITY_BUTTON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M10.1924"],svg path[d^="M10 1.62662"])`;
// The bell path fills more of its 20px viewBox than the neighbouring search
// glyph. Keep the action surface at the native 28px size, but normalize the
// rendered bell to the same optical height as the other toolbar glyphs.
const SIDEBAR_ACTIVITY_ICON_SELECTOR = `${SIDEBAR_ACTIVITY_BUTTON_SELECTOR}>svg`;
const SIDEBAR_ACTIVITY_ICON_DECLARATIONS =
  "width:calc(var(--spacing) * 3.5)!important;height:calc(var(--spacing) * 3.5)!important;";
const SIDEBAR_ACTIVITY_ATTENTION_BELL_SELECTOR =
  `${SIDEBAR_ACTIVITY_BUTTON_SELECTOR} svg path[d^="M10.1924"]`;
const SIDEBAR_ACTIVITY_NORMAL_BELL_PATH =
  "M10 1.62662C11.8117 1.62662 13.3045 2.24972 14.3633 3.31021C15.4168 4.36554 15.9988 5.81146 16.0781 7.39029L16.2324 10.4401C16.2396 10.5824 16.2766 10.7217 16.3418 10.8483L17.3731 12.8473C17.587 13.2621 17.6503 13.7943 17.419 14.2614C17.1674 14.7691 16.6502 15.0396 16.0371 15.0397H13.9434C13.6266 16.9314 11.9817 18.3727 10 18.3727C8.01845 18.3725 6.37423 16.9313 6.05763 15.0397H3.96388C3.35063 15.0397 2.83259 14.7693 2.58107 14.2614C2.34977 13.7943 2.41301 13.2621 2.62697 12.8473L3.65822 10.8483C3.72348 10.7216 3.76138 10.5825 3.76857 10.4401L3.92189 7.39029C4.00121 5.81129 4.58404 4.36557 5.63771 3.31021C6.69649 2.24974 8.18842 1.62665 10 1.62662ZM7.41896 15.0397C7.71461 16.1911 8.75629 17.0425 10 17.0426C11.2439 17.0426 12.2862 16.1912 12.582 15.0397H7.41896ZM10 2.9567C8.50663 2.95673 7.36381 3.46274 6.57814 4.24966C5.78759 5.04163 5.316 6.16189 5.25099 7.45767L5.09669 10.5075C5.07992 10.839 4.992 11.1636 4.83986 11.4586L3.80958 13.4577C3.74517 13.5826 3.76889 13.6623 3.77345 13.6715L3.7754 13.6735C3.77659 13.6744 3.77926 13.6762 3.78322 13.6784C3.79744 13.6863 3.84926 13.7096 3.96388 13.7096H16.0371C16.1518 13.7096 16.2037 13.6862 16.2178 13.6784C16.2215 13.6763 16.2235 13.6744 16.2246 13.6735C16.2256 13.6727 16.2264 13.6726 16.2266 13.6725L16.2276 13.6715C16.2321 13.6624 16.2557 13.5825 16.1914 13.4577L15.1602 11.4586C15.008 11.1636 14.9201 10.839 14.9033 10.5075L14.75 7.45767L14.7324 7.21646C14.6241 6.02283 14.1631 4.99211 13.4219 4.24966C12.6362 3.46271 11.4935 2.9567 10 2.9567Z";
const SIDEBAR_ACTIVITY_ATTENTION_BELL_DECLARATIONS =
  `d:path("${SIDEBAR_ACTIVITY_NORMAL_BELL_PATH}")!important;`;
const SIDEBAR_ACTIVITY_ATTENTION_DOT_SELECTOR =
  `${SIDEBAR_ACTIVITY_BUTTON_SELECTOR} svg path[d^="M14.1562 6.63542"]`;
const SIDEBAR_ACTIVITY_ATTENTION_DOT_DECLARATIONS =
  "display:none!important;content:none!important;";
const SIDEBAR_ACTIVITY_ACTIVE_BUTTON_SELECTOR =
  `${SIDEBAR_ACTIVITY_BUTTON_SELECTOR}[aria-pressed="true"]`;
const SIDEBAR_ACTIVITY_ACTIVE_BUTTON_DECLARATIONS =
  "background-color:transparent!important;border-color:transparent!important;color:var(--color-token-text-tertiary)!important;box-shadow:none!important;outline:none!important;";
// The native sidebar wrapper contains the header actions, but its layout and
// stacking boundaries otherwise trap the fixed actions inside the sidebar.
const SIDEBAR_LAYOUT_ROOT_SELECTOR =
  '.app-shell-left-panel div.select-none.box-border.flex.h-full.w-full.isolate.flex-col[class*="[contain:layout_paint]"]:has(>div>nav[role="navigation"])';
const SIDEBAR_LAYOUT_ROOT_DECLARATIONS =
  "contain:none!important;";
const SIDEBAR_SCROLL_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} [data-app-action-sidebar-scroll]`;
const SIDEBAR_SCROLL_DECLARATIONS =
  "margin-top:0!important;margin-bottom:var(--sidebar-footer-height)!important;padding-top:0!important;padding-bottom:4px!important;--sidebar-scroll-header-fade-start:0px!important;--sidebar-scroll-footer-edge:100%!important;";
const SIDEBAR_LEFT_PANEL_SELECTOR = ".app-shell-left-panel";
const SIDEBAR_FLOATING_PANEL_SELECTOR =
  '[data-pip-obstacle="app-shell-floating-left-panel"]';
const SIDEBAR_FLOATING_LAYOUT_ROOT_SELECTOR =
  `${SIDEBAR_FLOATING_PANEL_SELECTOR} div.select-none.box-border.flex.h-full.w-full.isolate.flex-col[class*="[contain:layout_paint]"]:has(>div>nav[role="navigation"])`;
const SIDEBAR_FLOATING_PANEL_DECLARATIONS =
  "top:calc(var(--height-toolbar) + 0.5px)!important;";
const SIDEBAR_FLOATING_PANEL_ASIDE_SELECTOR =
  `${SIDEBAR_FLOATING_PANEL_SELECTOR}>aside`;
const SIDEBAR_FLOATING_SEARCH_AND_ACTIVITY_BUTTON_SELECTOR =
  `${SIDEBAR_FLOATING_PANEL_SELECTOR} button:is([aria-label="Search"],[aria-label^="View activity"])`;
const SIDEBAR_FLOATING_PANEL_ASIDE_DECLARATIONS =
  "border-top-left-radius:0!important;";
const SIDEBAR_WINDOWS_ACCENT_TOKEN_DECLARATIONS =
  "--codex-windows-accent-color:transparent!important;";
const SIDEBAR_WINDOWS_ACCENT_COLOR_PROPERTY = "--codex-windows-accent-color";
const SIDEBAR_ACRYLIC_SURFACE_DECLARATIONS =
  "background-color:transparent!important;background-image:linear-gradient(color-mix(in srgb,var(--codex-windows-accent-color) 18%,transparent),color-mix(in srgb,var(--codex-windows-accent-color) 18%,transparent))!important;backdrop-filter:blur(20px) saturate(140%)!important;";
const SIDEBAR_FOOTER_SEPARATOR_PATH =
  `[aria-hidden='true'][class~='pointer-events-none'][class~='absolute'][class~='inset-x-0'][class~='top-0'][class~='z-10'][class~='h-[0.5px]'][class~='bg-token-foreground/10']`;
const SIDEBAR_FOOTER_SEPARATOR_SELECTOR =
  `${SIDEBAR_LEFT_PANEL_SELECTOR} ${SIDEBAR_FOOTER_SEPARATOR_PATH}`;
const SIDEBAR_PROFILE_TOOLBAR_SELECTOR =
  `${SIDEBAR_FOOTER_SEPARATOR_SELECTOR}~[class~='flex'][class~='h-toolbar'][class~='items-center'][class~='gap-2'][class~='px-row-x']`;
const SIDEBAR_PROFILE_TOOLBAR_DECLARATIONS =
  "height:auto!important;align-items:flex-start!important;padding-top:6px!important;padding-bottom:8px!important;";
const SIDEBAR_TOP_TRIGGER_SELECTOR =
  "[class*='ApplicationMenuTopBar'] [data-app-shell-sidebar-trigger]";
const SIDEBAR_TOP_TRIGGER_DECLARATIONS =
  "transform:translateX(3px)!important;";
const SIDEBAR_TOP_NAVIGATION_GROUP_SELECTOR =
  "[class*='ApplicationMenuTopBar']>div.flex.items-center.gap-1";
const SIDEBAR_TOP_NAVIGATION_GROUP_DECLARATIONS =
  "gap:0!important;";
// The collapsed floating panel wraps its duplicate navigation group in a full
// toolbar. Hide that parent so the empty toolbar row is removed as well.
const SIDEBAR_FLOATING_PANEL_HEADER_SELECTOR =
  '[data-testid="app-shell-floating-left-panel"]>:has([data-app-shell-sidebar-trigger])';
const SIDEBAR_HELP_BUTTON_SELECTOR =
  `${SIDEBAR_ROOT_SELECTOR} button:has(svg path[d^="M16.585 10C16.585"])`;
const REMOTE_CONVERSATION_HEADER_SELECTOR =
  ".draggable.grid.w-full.min-w-0.items-center.gap-x-4.electron\\:h-toolbar.extension\\:py-row-y";
const REMOTE_CONVERSATION_NO_PROJECT_TITLE_SELECTOR =
  `${REMOTE_CONVERSATION_HEADER_SELECTOR}>.text-md.flex.min-w-0.items-center.gap-2.truncate.text-base.electron\\:font-medium>.flex.min-w-0.items-center.gap-0\\.5.ps-2`;
const REMOTE_CONVERSATION_NO_PROJECT_TITLE_DECLARATIONS =
  "padding-inline-start:calc(var(--spacing) * 3)!important;";
const REMOTE_CONVERSATION_HEADER_ACTIONS_SELECTOR =
  `${REMOTE_CONVERSATION_HEADER_SELECTOR}>.flex.items-center.justify-end.gap-1\\.5>.flex.items-center.gap-0\\.5`;
const REMOTE_CONVERSATION_PR_ACTION_SELECTOR =
  `${REMOTE_CONVERSATION_HEADER_ACTIONS_SELECTOR}>button.shrink-0:last-child`;
const FULL_WIDTH_HEADER_CONTEXT_SURFACE_SELECTOR =
  '[data-testid="app-shell-header-context-menu-surface"][aria-hidden="true"]';
const FULL_WIDTH_HEADER_CONTEXT_SURFACE_DECLARATIONS =
  "visibility:visible!important;";
const MAIN_SURFACE_SELECTOR = "main[data-app-shell-main-surface]";
const COLLAPSED_MAIN_SURFACE_SELECTOR =
  `:root[data-codex-os="win32"] ${MAIN_SURFACE_SELECTOR}:not(.app-shell-left-panel ~ main)`;
const COLLAPSED_MAIN_SURFACE_TOP_LEFT_RADIUS_DECLARATIONS =
  "border-top-left-radius:0!important;";
// Keep the native activity slot and replace only its long-lived transform
// spinner with one centered, theme-aware breathing dot.
const SIDEBAR_THREAD_ACTIVITY_SELECTOR =
  "[data-app-action-sidebar-thread-row] .animate-spin";
const SIDEBAR_THREAD_ACTIVITY_DECLARATIONS =
  "animation:none!important;position:relative!important;width:20px!important;height:20px!important;";
const SIDEBAR_THREAD_ACTIVITY_ICON_SELECTOR =
  `${SIDEBAR_THREAD_ACTIVITY_SELECTOR}>svg`;
const SIDEBAR_THREAD_ACTIVITY_ICON_DECLARATIONS = "display:none!important;";
const SIDEBAR_THREAD_ACTIVITY_DOTS_SELECTOR =
  `${SIDEBAR_THREAD_ACTIVITY_SELECTOR}::before`;
const SIDEBAR_THREAD_ACTIVITY_DOTS_DECLARATIONS =
  "content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;border-radius:9999px;background:var(--color-token-conversation-body);transform:translate(-50%,-50%) scale(.85);transform-origin:center;animation:codex-app-sidebar-thread-activity-dot 1.6s steps(16,end) infinite alternate;";
const SIDEBAR_THREAD_ACTIVITY_DOTS_KEYFRAMES =
  "@keyframes codex-app-sidebar-thread-activity-dot{from{opacity:.55;transform:translate(-50%,-50%) scale(.85)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}";
// Remove native shimmer painting and keep only a low-cadence breath on the
// visible status text. The duplicated aria-hidden sweep is hidden explicitly.
const MAIN_SURFACE_LEGACY_SHIMMER_SELECTORS = [
  `${MAIN_SURFACE_SELECTOR} .loading-shimmer-pure-text:not(:has(>span[aria-hidden='true']))`,
  `${MAIN_SURFACE_SELECTOR} .loading-shimmer-pure-text-inverted`,
  `${MAIN_SURFACE_SELECTOR} .loading-shimmer:not(:has(>span[aria-hidden='true']))`,
];
const MAIN_SURFACE_LEGACY_SHIMMER_DECLARATIONS =
  "background:none!important;background-image:none!important;-webkit-text-fill-color:currentColor!important;animation:codex-app-status-breath 1.6s steps(16,end) infinite alternate!important;";
const MAIN_SURFACE_CADENCED_SHIMMER_SELECTOR =
  `${MAIN_SURFACE_SELECTOR} .loading-shimmer-pure-text:has(>span[aria-hidden='true'])`;
const MAIN_SURFACE_CADENCED_SHIMMER_DECLARATIONS =
  "background:none!important;background-image:none!important;-webkit-text-fill-color:currentColor!important;animation:codex-app-status-breath 1.6s steps(16,end) infinite alternate!important;";
const MAIN_SURFACE_CADENCED_SHIMMER_SWEEP_SELECTOR =
  `${MAIN_SURFACE_CADENCED_SHIMMER_SELECTOR}>span[aria-hidden='true']`;
const MAIN_SURFACE_CADENCED_SHIMMER_SWEEP_DECLARATIONS =
  "display:none!important;animation:none!important;";
const MAIN_SURFACE_CADENCED_SHIMMER_KEYFRAMES =
  "@keyframes codex-app-status-breath{from{opacity:.72}to{opacity:1}}";
const REDUCED_MOTION_STYLE_RULES = [
  `@media (prefers-reduced-motion: reduce){${cssRule(
    SIDEBAR_THREAD_ACTIVITY_DOTS_SELECTOR,
    "animation:none!important;opacity:1!important;transform:translate(-50%,-50%) scale(1)!important;",
  )}${cssRule(
    [
      ...MAIN_SURFACE_LEGACY_SHIMMER_SELECTORS,
      MAIN_SURFACE_CADENCED_SHIMMER_SELECTOR,
    ],
    "animation:none!important;opacity:1!important;",
  )}}`,
];
// The retained Browser panel always mounts this pulse, even when its parent is
// aria-hidden and opacity-0. Stop only that hidden instance; visible progress
// feedback and unrelated pulse/spin indicators keep their native animation.
const MAIN_SURFACE_HIDDEN_BROWSER_PROGRESS_SELECTOR =
  `${MAIN_SURFACE_SELECTOR} [aria-hidden='true'][class~='opacity-0'] > [class~='animate-pulse'][class~='bg-token-progress-bar-background']`;
const MAIN_SURFACE_HIDDEN_BROWSER_PROGRESS_DECLARATIONS =
  "animation:none!important;will-change:auto!important;";
const MAIN_SURFACE_BOTTOM_LEFT_RADIUS_DECLARATIONS =
  "border-bottom-left-radius:var(--radius-lg)!important;";
const RIGHT_PANEL_SELECTOR =
  'aside[data-app-shell-focus-area="right-panel"]';
const WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE =
  "data-codex-app-ui-hide-windows-menu-bar";
const RIGHT_PANEL_HEADER_SPACER_SELECTOR =
  `:root[${WINDOWS_MENU_BAR_HIDDEN_ATTRIBUTE}="true"] ${RIGHT_PANEL_SELECTOR} [data-testid="right-panel-tab-bar-header-spacer"]`;
const RIGHT_PANEL_TAB_TOOLBAR_SELECTOR =
  `${RIGHT_PANEL_SELECTOR} [data-app-shell-tabs="true"]>:has(>[data-app-shell-tab-strip-controller])`;
const RIGHT_PANEL_TAB_TOOLBAR_DECLARATIONS =
  "height:var(--height-toolbar-sm)!important;min-height:var(--height-toolbar-sm)!important;border-bottom:1px solid var(--color-token-border)!important;";
function cssRule(selectors, declarations) {
  const selector = Array.isArray(selectors) ? selectors.join(",") : selectors;
  return `${selector}{${declarations}}`;
}

const BASE_STYLE_RULES = [
  cssRule(":root", SIDEBAR_WINDOWS_ACCENT_TOKEN_DECLARATIONS),
  cssRule(
    SIDEBAR_LAYOUT_ROOT_SELECTOR,
    SIDEBAR_LAYOUT_ROOT_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FLOATING_LAYOUT_ROOT_SELECTOR,
    SIDEBAR_LAYOUT_ROOT_DECLARATIONS,
  ),
  cssRule(SIDEBAR_HEADER_MODE_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    SIDEBAR_HEADER_ACTIONS_SELECTOR,
    SIDEBAR_HEADER_ACTIONS_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_HEADER_ACTION_BUTTONS_SELECTOR,
    SIDEBAR_HEADER_ACTION_BUTTONS_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_HEADER_ACTION_ICON_SELECTOR,
    SIDEBAR_HEADER_ACTION_ICON_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_ACTIVITY_ICON_SELECTOR,
    SIDEBAR_ACTIVITY_ICON_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_ACTIVITY_ATTENTION_BELL_SELECTOR,
    SIDEBAR_ACTIVITY_ATTENTION_BELL_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_ACTIVITY_ATTENTION_DOT_SELECTOR,
    SIDEBAR_ACTIVITY_ATTENTION_DOT_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_ACTIVITY_ACTIVE_BUTTON_SELECTOR,
    SIDEBAR_ACTIVITY_ACTIVE_BUTTON_DECLARATIONS,
  ),
  cssRule(SIDEBAR_TOP_TRIGGER_SELECTOR, SIDEBAR_TOP_TRIGGER_DECLARATIONS),
  cssRule(
    SIDEBAR_TOP_NAVIGATION_GROUP_SELECTOR,
    SIDEBAR_TOP_NAVIGATION_GROUP_DECLARATIONS,
  ),
  cssRule(INVITE_FRIEND_MENU_ITEM_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(PET_MENU_ITEM_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(GIFT_CREDITS_MENU_ITEM_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(PROFILE_MENU_SELECTOR, PROFILE_MENU_DECLARATIONS),
];

const SIDEBAR_SCROLL_STYLE_RULES = [
  cssRule(SIDEBAR_ROOT_SELECTOR, SIDEBAR_ROOT_DECLARATIONS),
  cssRule(SIDEBAR_SCROLL_SELECTOR, SIDEBAR_SCROLL_DECLARATIONS),
  cssRule(SIDEBAR_FOOTER_SEPARATOR_SELECTOR, "opacity:0!important;"),
  cssRule(SIDEBAR_PROFILE_TOOLBAR_SELECTOR, SIDEBAR_PROFILE_TOOLBAR_DECLARATIONS),
  cssRule(SIDEBAR_COMPACT_THREAD_ROW_SELECTOR, SIDEBAR_COMPACT_THREAD_ROW_DECLARATIONS),
  cssRule(
    SIDEBAR_COMPACT_THREAD_ROW_SELECTOR,
    SIDEBAR_THREAD_ROW_BORDER_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_TITLE_SCROLL_TRACK_SELECTOR,
    SIDEBAR_THREAD_TITLE_SCROLL_TRACK_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_TITLE_SCROLL_COPY_SELECTOR,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_OVERFLOWING_THREAD_TITLE_ON_HOVER_SELECTOR,
    SIDEBAR_OVERFLOWING_THREAD_TITLE_ON_HOVER_DECLARATIONS,
  ),
  cssRule(SIDEBAR_THREAD_ROW_HOVER_SELECTOR, SIDEBAR_THREAD_ROW_HOVER_DECLARATIONS),
  cssRule(
    SIDEBAR_OTHER_SURFACE_HOVER_SELECTOR,
    SIDEBAR_OTHER_SURFACE_HOVER_DECLARATIONS,
  ),
  cssRule(SIDEBAR_HOVER_CARD_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    SIDEBAR_THREAD_ROW_ACTION_RAIL_SELECTOR,
    SIDEBAR_THREAD_ROW_ACTION_RAIL_DECLARATIONS,
  ),
  cssRule(
    `${SIDEBAR_THREAD_ROW_SPACER_SELECTOR}::after`,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ARCHIVE_MOTION_SELECTOR,
    SIDEBAR_THREAD_ARCHIVE_MOTION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_DND_ITEM_SELECTOR,
    SIDEBAR_THREAD_DND_ITEM_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_GROUP_DND_ITEM_SELECTOR,
    SIDEBAR_GROUP_DND_ITEM_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ROW_FLOATING_STATUS_WITH_ACTIONS_SELECTOR,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ROW_ACTION_SLOT_SELECTOR,
    SIDEBAR_THREAD_ROW_ACTION_SLOT_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ROW_STATUS_SPACER_WITH_ACTIONS_SELECTOR,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(SIDEBAR_COMPACT_PROJECT_ROW_SELECTOR, SIDEBAR_COMPACT_PROJECT_ROW_DECLARATIONS),
  cssRule(SIDEBAR_COMPACT_PROJECT_CONTENT_SELECTOR, SIDEBAR_COMPACT_PROJECT_CONTENT_DECLARATIONS),
  cssRule(
    SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_SELECTOR,
    SIDEBAR_PROJECT_CONTENT_WITH_SHOW_MORE_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_PROJECT_CONTENT_MOTION_SELECTOR,
    SIDEBAR_PROJECT_CONTENT_MOTION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_COLLAPSED_PROJECT_CONTENT_MOTION_SELECTOR,
    SIDEBAR_COLLAPSED_PROJECT_CONTENT_MOTION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_GROUP_CONTENT_MOTION_SELECTOR,
    SIDEBAR_GROUP_CONTENT_MOTION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_COLLAPSED_GROUP_CONTENT_MOTION_SELECTOR,
    SIDEBAR_COLLAPSED_GROUP_CONTENT_MOTION_DECLARATIONS,
  ),
  cssRule(SIDEBAR_PROJECT_TITLE_SELECTOR, SIDEBAR_PROJECT_TITLE_DECLARATIONS),
  cssRule(SIDEBAR_NAV_ROW_SELECTOR, SIDEBAR_NAV_ROW_DECLARATIONS),
  cssRule(SIDEBAR_PRIMARY_NAV_ACTION_SELECTOR, SIDEBAR_PRIMARY_NAV_ACTION_DECLARATIONS),
  cssRule(SIDEBAR_NAV_LEADING_ICON_SELECTOR, SIDEBAR_LEADING_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_LEADING_ICON_SELECTOR, SIDEBAR_LEADING_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_ACTION_SELECTOR, SIDEBAR_PROJECT_ROW_ACTION_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_ACTION_ICON_SELECTOR, SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_SELECTOR, SIDEBAR_PROJECT_ROW_MENU_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_INSET_SELECTOR, SIDEBAR_PROJECT_ROW_MENU_INSET_DECLARATIONS),
  cssRule(SIDEBAR_PROJECT_ROW_MENU_ICON_SELECTOR, SIDEBAR_HOVER_ACTION_ICON_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_ACTIONS_SELECTOR, SIDEBAR_SECTION_ACTIONS_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_CONTENT_SELECTOR, SIDEBAR_SECTION_CONTENT_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_TOGGLE_SELECTOR, SIDEBAR_SECTION_TOGGLE_DECLARATIONS),
  cssRule(SIDEBAR_OFFSET_SECTION_TITLE_SELECTOR, SIDEBAR_OFFSET_SECTION_TITLE_DECLARATIONS),
  cssRule(SIDEBAR_SECTION_TOGGLE_ICON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    SIDEBAR_SECTION_TOGGLE_ICON_TRANSITION_SELECTOR,
    SIDEBAR_SECTION_TOGGLE_ICON_TRANSITION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FOLDER_TOGGLE_MOTION_SELECTOR,
    SIDEBAR_FOLDER_TOGGLE_MOTION_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_EXPANDED_FOLDER_TOGGLE_ICON_SELECTOR,
    SIDEBAR_EXPANDED_FOLDER_TOGGLE_ICON_DECLARATIONS,
  ),
];
const IMAGE_PREVIEW_STYLE_RULES = [
  cssRule(
    ".absolute.top-3.right-3.z-10.flex.items-center.gap-2",
    "top:calc(0.75rem + 26px)!important;",
  ),
];

const APP_SHELL_STYLE_RULES = [
  cssRule(
    SIDEBAR_FLOATING_PANEL_SELECTOR,
    SIDEBAR_FLOATING_PANEL_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FLOATING_PANEL_ASIDE_SELECTOR,
    SIDEBAR_FLOATING_PANEL_ASIDE_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FLOATING_PANEL_ASIDE_SELECTOR,
    SIDEBAR_ACRYLIC_SURFACE_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_FLOATING_SEARCH_AND_ACTIVITY_BUTTON_SELECTOR,
    HIDDEN_DISPLAY_DECLARATIONS,
  ),
  cssRule(SIDEBAR_FLOATING_PANEL_HEADER_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    FULL_WIDTH_HEADER_CONTEXT_SURFACE_SELECTOR,
    FULL_WIDTH_HEADER_CONTEXT_SURFACE_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ACTIVITY_SELECTOR,
    SIDEBAR_THREAD_ACTIVITY_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ACTIVITY_ICON_SELECTOR,
    SIDEBAR_THREAD_ACTIVITY_ICON_DECLARATIONS,
  ),
  cssRule(
    SIDEBAR_THREAD_ACTIVITY_DOTS_SELECTOR,
    SIDEBAR_THREAD_ACTIVITY_DOTS_DECLARATIONS,
  ),
  SIDEBAR_THREAD_ACTIVITY_DOTS_KEYFRAMES,
  cssRule(
    MAIN_SURFACE_LEGACY_SHIMMER_SELECTORS,
    MAIN_SURFACE_LEGACY_SHIMMER_DECLARATIONS,
  ),
  cssRule(
    MAIN_SURFACE_CADENCED_SHIMMER_SELECTOR,
    MAIN_SURFACE_CADENCED_SHIMMER_DECLARATIONS,
  ),
  cssRule(
    MAIN_SURFACE_CADENCED_SHIMMER_SWEEP_SELECTOR,
    MAIN_SURFACE_CADENCED_SHIMMER_SWEEP_DECLARATIONS,
  ),
  MAIN_SURFACE_CADENCED_SHIMMER_KEYFRAMES,
  cssRule(
    MAIN_SURFACE_HIDDEN_BROWSER_PROGRESS_SELECTOR,
    MAIN_SURFACE_HIDDEN_BROWSER_PROGRESS_DECLARATIONS,
  ),
  cssRule(
    MAIN_SURFACE_SELECTOR,
    MAIN_SURFACE_BOTTOM_LEFT_RADIUS_DECLARATIONS,
  ),
  cssRule(
    COLLAPSED_MAIN_SURFACE_SELECTOR,
    COLLAPSED_MAIN_SURFACE_TOP_LEFT_RADIUS_DECLARATIONS,
  ),
  cssRule(RIGHT_PANEL_HEADER_SPACER_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(
    RIGHT_PANEL_TAB_TOOLBAR_SELECTOR,
    RIGHT_PANEL_TAB_TOOLBAR_DECLARATIONS,
  ),
];

const REMOTE_CONVERSATION_HEADER_STYLE_RULES = [
  cssRule(
    REMOTE_CONVERSATION_NO_PROJECT_TITLE_SELECTOR,
    REMOTE_CONVERSATION_NO_PROJECT_TITLE_DECLARATIONS,
  ),
  cssRule(REMOTE_CONVERSATION_PR_ACTION_SELECTOR, "order:-1!important;"),
];

const SETTINGS_STYLE_RULES = [
  cssRule(
    "nav:has([data-settings-panel-slug]) .min-h-0.flex-1.overflow-y-auto.pb-2",
    "margin-right:calc(var(--padding-row-x) * -1)!important;padding-right:var(--padding-row-x)!important;padding-bottom:1.25rem!important;",
  ),
];

const SIDEBAR_FOOTER_STYLE_RULES = [
  cssRule(SIDEBAR_HELP_BUTTON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
];

const USAGE_MENU_STYLE_RULES = [
  cssRule(USAGE_MENU_TRIGGER_SELECTOR, USAGE_MENU_TRIGGER_DECLARATIONS),
  cssRule(
    USAGE_MENU_TRIGGER_CONTENT_SELECTOR,
    USAGE_MENU_TRIGGER_CONTENT_DECLARATIONS,
  ),
  cssRule(USAGE_MENU_TRIGGER_CHEVRON_SELECTOR, HIDDEN_DISPLAY_DECLARATIONS),
  cssRule(USAGE_MENU_RATE_ROWS_SELECTOR, USAGE_MENU_RATE_ROWS_DECLARATIONS),
  cssRule(USAGE_MENU_RATE_LABEL_SELECTOR, USAGE_MENU_LABEL_DECLARATIONS),
  cssRule(USAGE_MENU_RESET_ACTION_SELECTOR, USAGE_MENU_RESET_ACTION_DECLARATIONS),
  cssRule(
    [
      `${USAGE_MENU_CONTENT_SELECTOR}>a[href*="highlight_plan="][href$="#pricing"]`,
      `${USAGE_MENU_CONTENT_SELECTOR}>a[href^="https://help.openai.com/en/articles/11369540-using-codex"]`,
    ],
    USAGE_MENU_LINK_DECLARATIONS,
  ),
];

const STYLE_RULES = [
  ...BASE_STYLE_RULES,
  ...SIDEBAR_SCROLL_STYLE_RULES,
  ...APP_SHELL_STYLE_RULES,
  ...IMAGE_PREVIEW_STYLE_RULES,
  ...REMOTE_CONVERSATION_HEADER_STYLE_RULES,
  ...SETTINGS_STYLE_RULES,
  ...SIDEBAR_FOOTER_STYLE_RULES,
  ...USAGE_MENU_STYLE_RULES,
  ...REDUCED_MOTION_STYLE_RULES,
];

function installStyle() {
  const existingStyle = document.getElementById(STYLE_ID);
  if (existingStyle) {
    existingStyle.textContent = STYLE_RULES.join("\n");
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = STYLE_RULES.join("\n");
  document.head.appendChild(style);
}

function applyWindowsAccentColorToken() {
  const accentColor = globalThis.__codexpp_windows_accent_color__;
  if (typeof accentColor !== "string" || !/^#[0-9a-f]{6}$/i.test(accentColor)) {
    return;
  }

  document.documentElement.style.setProperty(
    SIDEBAR_WINDOWS_ACCENT_COLOR_PROPERTY,
    accentColor,
    "important",
  );
}

module.exports = {
  start() {
    installStyle();
    applyWindowsAccentColorToken();
  },

  stop() {
    document.getElementById(STYLE_ID)?.remove();
  },
};
