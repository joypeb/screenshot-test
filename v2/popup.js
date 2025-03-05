document.addEventListener('DOMContentLoaded', function () {
  const screenshotBtn = document.getElementById('screenshotBtn');
  screenshotBtn.addEventListener('click', function () {
    console.log("스크린샷 모드 활성화");
    // 현재 활성 탭에서 스크린샷 모드 활성화 스크립트 실행
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        function: activateScreenshotMode
      });
    });
  });
});

function activateScreenshotMode() {
  // 이 함수는 현재 페이지에서 실행됩니다.
  alert("스크린샷 모드 활성화됨!");
  // 이후 스크린샷 모드 관련 로직을 추가합니다.
}