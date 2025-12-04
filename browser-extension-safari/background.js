// Background service worker for Launchpad extension
// Currently minimal - can be extended for future features

chrome.runtime.onInstalled.addListener(() => {
  console.log('Launchpad Quick Add extension installed');
});

