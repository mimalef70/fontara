'use strict';

window.browser = (function() {
  return window.msBrowser || window.browser || window.chrome;
})();

const selectFontElement = document.querySelector('#fonttools-font');

const twitterStatus = document.querySelector('#twitter');
const facebookStatus = document.querySelector('#facebook');
const linkedinStatus = document.querySelector('#linkedin');
const gmailStatus = document.querySelector('#gmail');
const googleStatus = document.querySelector('#google');
const instagramStatus = document.querySelector('#instagram');
const googleplusStatus = document.querySelector('#googleplus');
const mediumStatus = document.querySelector('#medium');
const getpocketStatus = document.querySelector('#getpocket');
const slackStatus = document.querySelector('#slack');
const telegramStatus = document.querySelector('#telegram');
const trelloStatus = document.querySelector('#trello');
const whatsappStatus = document.querySelector('#whatsapp');
const wikipediaStatus = document.querySelector('#wikipedia');
const youtubeStatus = document.querySelector('#youtube');
const paperdropboxStatus = document.querySelector('#paperdropbox');
const inoreaderStatus = document.querySelector('#inoreader');
const feedlyStatus = document.querySelector('#feedly');
const goodreadsStatus = document.querySelector('#goodreads');
const githubStatus = document.querySelector('#github');

browser.storage.local.get(
  [
    'twitter',
    'facebook',
    'linkedin',
    'gmail',
    'google',
    'instagram',
    'googleplus',
    'medium',
    'getpocket',
    'slack',
    'telegram',
    'trello',
    'whatsapp',
    'wikipedia',
    'youtube',
    'paperdropbox',
    'inoreader',
    'feedly',
    'goodreads',
    'github'
  ],
  function(data) {
    if (data.twitter == undefined) {
      browser.storage.local.set({ twitter: true });
      twitterStatus.checked = true;
    } else {
      if (data.twitter == true) {
        twitterStatus.checked = true;
      } else {
        twitterStatus.checked = false;
      }
    }
    if (data.facebook == undefined) {
      browser.storage.local.set({ facebook: true });
      facebookStatus.checked = true;
    } else {
      if (data.facebook == true) {
        facebookStatus.checked = true;
      } else {
        facebookStatus.checked = false;
      }
    }
    if (data.linkedin == undefined) {
      browser.storage.local.set({ linkedin: true });
      linkedinStatus.checked = true;
    } else {
      if (data.linkedin == true) {
        linkedinStatus.checked = true;
      } else {
        linkedinStatus.checked = false;
      }
    }
    if (data.gmail == undefined) {
      browser.storage.local.set({ gmail: true });
      gmailStatus.checked = true;
    } else {
      if (data.gmail == true) {
        gmailStatus.checked = true;
      } else {
        gmailStatus.checked = false;
      }
    }
    if (data.google == undefined) {
      browser.storage.local.set({ google: true });
      googleStatus.checked = true;
    } else {
      if (data.google == true) {
        googleStatus.checked = true;
      } else {
        googleStatus.checked = false;
      }
    }
    if (data.instagram == undefined) {
      browser.storage.local.set({ instagram: true });
      instagramStatus.checked = true;
    } else {
      if (data.instagram == true) {
        instagramStatus.checked = true;
      } else {
        instagramStatus.checked = false;
      }
    }
    if (data.googleplus == undefined) {
      browser.storage.local.set({ googleplus: true });
      googleplusStatus.checked = true;
    } else {
      if (data.googleplus == true) {
        googleplusStatus.checked = true;
      } else {
        googleplusStatus.checked = false;
      }
    }
    if (data.medium == undefined) {
      browser.storage.local.set({ medium: true });
      mediumStatus.checked = true;
    } else {
      if (data.medium == true) {
        mediumStatus.checked = true;
      } else {
        mediumStatus.checked = false;
      }
    }
    if (data.getpocket == undefined) {
      browser.storage.local.set({ getpocket: true });
      getpocketStatus.checked = true;
    } else {
      if (data.getpocket == true) {
        getpocketStatus.checked = true;
      } else {
        getpocketStatus.checked = false;
      }
    }
    if (data.slack == undefined) {
      browser.storage.local.set({ slack: true });
      slackStatus.checked = true;
    } else {
      if (data.slack == true) {
        slackStatus.checked = true;
      } else {
        slackStatus.checked = false;
      }
    }
    if (data.telegram == undefined) {
      browser.storage.local.set({ telegram: true });
      telegramStatus.checked = true;
    } else {
      if (data.telegram == true) {
        telegramStatus.checked = true;
      } else {
        telegramStatus.checked = false;
      }
    }
    if (data.trello == undefined) {
      browser.storage.local.set({ trello: true });
      trelloStatus.checked = true;
    } else {
      if (data.trello == true) {
        trelloStatus.checked = true;
      } else {
        trelloStatus.checked = false;
      }
    }
    if (data.whatsapp == undefined) {
      browser.storage.local.set({ whatsapp: true });
      whatsappStatus.checked = true;
    } else {
      if (data.whatsapp == true) {
        whatsappStatus.checked = true;
      } else {
        whatsappStatus.checked = false;
      }
    }
    if (data.wikipedia == undefined) {
      browser.storage.local.set({ wikipedia: true });
      wikipediaStatus.checked = true;
    } else {
      if (data.wikipedia == true) {
        wikipediaStatus.checked = true;
      } else {
        wikipediaStatus.checked = false;
      }
    }
    if (data.youtube == undefined) {
      browser.storage.local.set({ youtube: true });
      youtubeStatus.checked = true;
    } else {
      if (data.youtube == true) {
        youtubeStatus.checked = true;
      } else {
        youtubeStatus.checked = false;
      }
    }
    if (data.paperdropbox == undefined) {
      browser.storage.local.set({ paperdropbox: true });
      paperdropboxStatus.checked = true;
    } else {
      if (data.paperdropbox == true) {
        paperdropboxStatus.checked = true;
      } else {
        paperdropboxStatus.checked = false;
      }
    }
    if (data.inoreader == undefined) {
      browser.storage.local.set({ inoreader: true });
      inoreaderStatus.checked = true;
    } else {
      if (data.inoreader == true) {
        inoreaderStatus.checked = true;
      } else {
        inoreaderStatus.checked = false;
      }
    }
    if (data.feedly == undefined) {
      browser.storage.local.set({ feedly: true });
      feedlyStatus.checked = true;
    } else {
      if (data.feedly == true) {
        feedlyStatus.checked = true;
      } else {
        feedlyStatus.checked = false;
      }
    }
    if (data.goodreads == undefined) {
      browser.storage.local.set({ goodreads: true });
      goodreadsStatus.checked = true;
    } else {
      if (data.goodreads == true) {
        goodreadsStatus.checked = true;
      } else {
        goodreadsStatus.checked = false;
      }
    }
    if (data.github == undefined) {
      browser.storage.local.set({ github: true });
      githubStatus.checked = true;
    } else {
      if (data.github == true) {
        githubStatus.checked = true;
      } else {
        githubStatus.checked = false;
      }
    }
  }
);

document.querySelectorAll("[type='checkbox']").forEach(function(el) {
  el.addEventListener('change', function() {
    if (this.checked == false) {
      browser.storage.local.set({ [this.getAttribute('id')]: false });
    } else {
      browser.storage.local.set({ [this.getAttribute('id')]: true });
    }
  });
});

selectFontElement.addEventListener('change', handleFont);

function handleFont() {
  browser.storage.local.set({ font: this.value });
}

browser.storage.local.get(['custom_fonts', 'font'], function(fonts) {
  if (fonts.custom_fonts != undefined) {
    var OptGroup = document.createElement('optgroup');
    OptGroup.label = 'فونت های شما';
    OptGroup.id = 'custom-font';
    document.getElementById('fonttools-font').appendChild(OptGroup);
    Object.keys(fonts.custom_fonts).forEach(function(item) {
      var CustomFontOption = document.createElement('option');
      CustomFontOption.textContent = item;
      CustomFontOption.value = item;
      document.getElementById('custom-font').appendChild(CustomFontOption);
    });
  }
  selectFontElement.value = fonts.font;
  const choices = new Choices('#fonttools-font', {
    searchEnabled: false,
    shouldSort: false,
    noResultsText: 'نتیجه ای یافت نشد',
    itemSelectText: '!بِستَک دل و دین از من از من',
    googleEnabled: false
  });
});

var query = { active: true, currentWindow: true };
function callback(tabs) {
  var currentTab = tabs[0]; // there will be only one in this array
  var url = new URL(currentTab.url).hostname.replace(/\./g, '-');
  const link = document.querySelector('#developer');

  link.addEventListener('click', e => {
    e.preventDefault();
    if (url === 'www-linkedin-com') {
      chrome.tabs.create({
        url: 'https://www.linkedin.com/in/mostafaalahyari/'
      });
    } else {
      chrome.tabs.create({
        url: 'https://twitter.com/mimalef70'
      });
    }
  });
}

chrome.tabs.query(query, callback);

window.addEventListener('load', function() {
  browser.storage.local.get(['font'], function(fonts) {
    document
      .querySelector(`.choices__list--dropdown [data-value='${fonts.font}']`)
      .classList.add('selected-item');
  });

  selectFontElement.addEventListener('change', function() {
    var elems = document.querySelectorAll(
      'choices__list--dropdown .choices__item--choice'
    );
    [].forEach.call(elems, function(el) {
      el.classList.remove('selected-item');
    });
    document
      .querySelector(`.choices__list--dropdown [data-value='${this.value}']`)
      .classList.add('selected-item');
    console.log(
      document.querySelector(
        `.choices__list--dropdown [data-value='${this.value}']`
      )
    );
  });
});

const links = document.querySelectorAll('a.new-tab');
for (const link of links) {
  link.addEventListener('click', e => {
    e.preventDefault();

    chrome.tabs.create({
      url: link.href
    });
  });
}
