export {}
console.log("HELLO WORLD FROM BGSCRIPTS")

chrome.action.onClicked.addListener(() => {
  console.log(`action clicked:`)
})
