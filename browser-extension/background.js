// Background service worker for LaunchIt extension
// Currently minimal - can be extended for future features

chrome.runtime.onInstalled.addListener(() => {
  console.log('LaunchIt Quick Add extension installed');
});

