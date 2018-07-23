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
//   chrome.tabs.create({ url: 'http://www.ok.com' }, function() {});
// });
