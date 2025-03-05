'use strict';

const browserAPI = chrome || browser;

browserAPI.runtime.onInstalled.addListener(() => {
  browserAPI.storage.local.get(['font'], (result) => {
    if (result.font === undefined) {
      browserAPI.storage.local.set({ font: 'Vazir' });
    }
  });

  browserAPI.tabs.create({
    url: 'https://mimalef70.github.io/fontara#changelogs'
  });

  browserAPI.runtime.setUninstallURL(
    'https://docs.google.com/forms/d/e/1FAIpQLSdkUvCG9vfASEits6qeAuH1UdtdAGlLp6I5QfJ4_jbsaKorLQ/viewform'
  );
});