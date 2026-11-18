(function (window) {
const N='var(--navy)', P='var(--peach)';
const ICONS = {
  settings:`<svg class="settings-gear-icon" viewBox="0 0 48 48" aria-hidden="true">
    <g class="gear-main" fill="${P}" stroke="${N}" stroke-width="1.2">
      <rect x="15.8" y="3.5" width="4.4" height="7" rx="1.2"/><rect x="15.8" y="25.5" width="4.4" height="7" rx="1.2"/>
      <rect x="3.5" y="15.8" width="7" height="4.4" rx="1.2"/><rect x="25.5" y="15.8" width="7" height="4.4" rx="1.2"/>
      <rect x="7.1" y="7.1" width="4.4" height="7" rx="1.2" transform="rotate(-45 9.3 10.6)"/>
      <rect x="24.5" y="24.5" width="4.4" height="7" rx="1.2" transform="rotate(-45 26.7 28)"/>
      <rect x="24.5" y="7.1" width="4.4" height="7" rx="1.2" transform="rotate(45 26.7 10.6)"/>
      <rect x="7.1" y="24.5" width="4.4" height="7" rx="1.2" transform="rotate(45 9.3 28)"/>
      <circle cx="18" cy="18" r="10.2"/><circle cx="18" cy="18" r="4.2" fill="#fff" stroke="${P}" stroke-width="2"/>
    </g>
    <g class="gear-small" fill="${N}" stroke="${P}" stroke-width="1">
      <rect x="31.3" y="22.5" width="3.4" height="5.5" rx="1"/><rect x="31.3" y="36" width="3.4" height="5.5" rx="1"/>
      <rect x="23.5" y="30.3" width="5.5" height="3.4" rx="1"/><rect x="37" y="30.3" width="5.5" height="3.4" rx="1"/>
      <rect x="25.7" y="24.7" width="3.4" height="5.5" rx="1" transform="rotate(-45 27.4 27.4)"/>
      <rect x="36.2" y="35.2" width="3.4" height="5.5" rx="1" transform="rotate(-45 37.9 37.9)"/>
      <rect x="36.2" y="24.7" width="3.4" height="5.5" rx="1" transform="rotate(45 37.9 27.4)"/>
      <rect x="25.7" y="35.2" width="3.4" height="5.5" rx="1" transform="rotate(45 27.4 37.9)"/>
      <circle cx="33" cy="32" r="6.5"/><circle cx="33" cy="32" r="2.5" fill="#fff" stroke="${N}" stroke-width="1.2"/>
    </g>
  </svg>`,
  dash:`<svg viewBox="0 0 48 48"><path d="M8 22 24 8l16 14v16a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" fill="${P}"/><rect x="19" y="27" width="10" height="14" rx="2" fill="#fff"/></svg>`,
  units:`<svg viewBox="0 0 48 48"><rect x="8" y="8" width="20" height="34" rx="3" fill="${N}"/><rect x="24" y="18" width="16" height="24" rx="3" fill="${P}"/><g><rect class="unit-window-light light-a" x="12" y="13" width="4" height="4" rx="1"/><rect class="unit-window-light light-b" x="19" y="13" width="4" height="4" rx="1"/><rect class="unit-window-light light-c" x="12" y="21" width="4" height="4" rx="1"/><rect class="unit-window-light light-d" x="19" y="21" width="4" height="4" rx="1"/><rect class="unit-window-light light-e" x="12" y="29" width="4" height="4" rx="1"/></g></svg>`,
  announcements:`<svg viewBox="0 0 48 48"><rect x="8" y="14" width="30" height="22" rx="5" fill="${N}"/><path d="M10 17l13 9 13-9" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="38" cy="13" r="5" fill="${P}"/></svg>`,
  requests:`<svg viewBox="0 0 48 48"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z" fill="${N}"/><g fill="${P}"><circle cx="17" cy="20" r="2.6"/><circle cx="24" cy="20" r="2.6"/><circle cx="31" cy="20" r="2.6"/></g></svg>`,
  'neighbor-alerts':`<svg viewBox="0 0 48 48"><path d="M24 5 42 38H6L24 5Z" fill="${P}"/><path d="M24 17v10" stroke="${N}" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="33" r="2" fill="${N}"/></svg>`,
  tx:`<svg viewBox="0 0 48 48"><rect x="6" y="12" width="30" height="20" rx="4" fill="${P}"/><rect x="12" y="18" width="30" height="20" rx="4" fill="${N}"/><path d="M18 26h10M18 31h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  pay:`<svg viewBox="0 0 48 48"><rect x="7" y="12" width="30" height="22" rx="4" fill="${N}"/><path d="M12 19h10M12 24h6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><circle cx="35" cy="33" r="8" fill="${P}"/><path d="M31.5 33l2.5 2.5 4.5-5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  report:`<svg viewBox="0 0 48 48"><path d="M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3z" fill="${N}"/><g stroke="${P}" stroke-width="2.6" stroke-linecap="round"><path d="M18 15h12M18 21h12M18 27h12"/></g></svg>`,
  rates:`<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="${N}"/><circle cx="24" cy="24" r="6" fill="${P}"/><g stroke="${N}" stroke-width="5" stroke-linecap="round"><path d="M24 4v4M24 40v4M4 24h4M40 24h4"/></g></svg>`,
  activity:`<svg viewBox="0 0 48 48"><path d="M14 33a14 14 0 1 1 20 0" stroke="${N}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M19 28a7 7 0 1 1 10 0" stroke="${N}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="24" cy="23" r="3.5" fill="${P}"/><path d="M24 26v14" stroke="${P}" stroke-width="4" stroke-linecap="round"/></svg>`,
  profile:`<svg viewBox="0 0 48 48"><circle cx="24" cy="17" r="8" fill="${N}"/><path d="M9 41a15 15 0 0 1 30 0z" fill="${P}"/></svg>`,
  services:`<svg viewBox="0 0 48 48"><g fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="8" width="13" height="13" rx="4"/><rect x="27" y="8" width="13" height="13" rx="4"/><rect x="8" y="27" width="13" height="13" rx="4"/><rect x="27" y="27" width="13" height="13" rx="4"/></g></svg>`,
  logout: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`
};
const LINE_ICONS = {
  dash:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M9 22 24 9l15 13v16a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z"/><path d="M20 41V29h8v12"/></svg>`,
  tx:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="7" y="11" width="30" height="20" rx="4"/><path d="M13 18h10M13 23h6"/><path d="M33 30v10m0 0-3-3m3 3 3-3M40 40V30m0 0-3 3m3-3 3 3" stroke-linecap="round"/></svg>`,
  pay:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="14" width="32" height="22" rx="4"/><path d="M14 25h7" stroke-linecap="round"/></svg>`,
  requests:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M8 12a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H20l-8 7v-7a4 4 0 0 1-4-4z"/></svg>`,
  report:`<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M12 7h24v34l-4-3-4 3-4-3-4 3-4-3-4 3z"/><path d="M18 16h12M18 23h12" stroke-linecap="round"/></svg>`,
  services: null,
};
LINE_ICONS.services = ICONS.services;
LINE_ICONS.settings = ICONS.settings;
const ico = k => ICONS[k] || ICONS.services;
Object.freeze(ICONS);
Object.freeze(LINE_ICONS);
window.ModirIcons = Object.freeze({ ICONS, LINE_ICONS, ico });
})(window);
