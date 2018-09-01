'use strict';

window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();

browser.storage.local.get('font', function(data) {
  if (typeof data.font === 'undefined') {
    browser.storage.local.set({ font: 'Vazir' });
  }
});

// browser.runtime.onInstalled.addListener(function() {
//   chrome.tabs.create(
//     { url: 'https://virgool.io/@mimalef70/fontara-font-changer-dvzsripy2669' },
//     function() {}
//   );
// });

browser.runtime.setUninstallURL(
  'https://docs.google.com/forms/d/e/1FAIpQLSdkUvCG9vfASEits6qeAuH1UdtdAGlLp6I5QfJ4_jbsaKorLQ/viewform'
);
