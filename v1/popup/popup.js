document.addEventListener('DOMContentLoaded', () => {
  // 요소 참조 가져오기
  const screenshotBtn = document.getElementById('screenshotBtn');
  const fullPageBtn = document.getElementById('fullPageBtn');
  const formatSelect = document.getElementById('formatSelect');
  const qualityContainer = document.getElementById('qualityContainer');
  const qualityRange = document.getElementById('qualityRange');
  const qualityValue = document.getElementById('qualityValue');
  const delaySelect = document.getElementById('delaySelect');

  // 저장된 설정 불러오기
  chrome.storage.sync.get({
    format: 'png',
    quality: 90,
    delay: 0
  }, (items) => {
    formatSelect.value = items.format;
    qualityRange.value = items.quality;
    qualityValue.textContent = `${items.quality}%`;
    delaySelect.value = items.delay;

    // JPEG 형식인 경우 품질 설정 표시
    if (items.format === 'jpeg') {
      qualityContainer.style.display = 'flex';
    }
  });

  // 영역 스크린샷 버튼 클릭 이벤트
  screenshotBtn.addEventListener('click', () => {
    // 설정 저장
    saveSettings();

    // 지연 시간 설정
    const delay = parseInt(delaySelect.value) * 1000;

    if (delay > 0) {
      // 팝업 닫기
      window.close();

      // 지연 후 스크린샷 모드 시작
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'initScreenshot' });
      }, delay);
    } else {
      // 즉시 스크린샷 모드 시작
      chrome.runtime.sendMessage({ action: 'initScreenshot' }, (response) => {
        if (response && response.success) {
          // 팝업 닫기
          window.close();
        }
      });
    }
  });

  // 전체 페이지 스크린샷 버튼 클릭 이벤트 (추가 기능)
  fullPageBtn.addEventListener('click', () => {
    // 설정 저장
    saveSettings();

    // 지연 시간 설정
    const delay = parseInt(delaySelect.value) * 1000;

    if (delay > 0) {
      // 팝업 닫기
      window.close();

      // 지연 후 전체 페이지 스크린샷 촬영
      setTimeout(() => {
        chrome.runtime.sendMessage({ action: 'captureFullPage' });
      }, delay);
    } else {
      // 즉시 전체 페이지 스크린샷 촬영
      chrome.runtime.sendMessage({ action: 'captureFullPage' }, () => {
        window.close();
      });
    }
  });

  // 파일 형식 변경 이벤트
  formatSelect.addEventListener('change', () => {
    // JPEG 선택시 품질 설정 표시
    if (formatSelect.value === 'jpeg') {
      qualityContainer.style.display = 'flex';
    } else {
      qualityContainer.style.display = 'none';
    }
  });

  // 품질 슬라이더 변경 이벤트
  qualityRange.addEventListener('input', () => {
    qualityValue.textContent = `${qualityRange.value}%`;
  });

  // 설정 저장 함수
  function saveSettings() {
    chrome.storage.sync.set({
      format: formatSelect.value,
      quality: parseInt(qualityRange.value),
      delay: parseInt(delaySelect.value)
    });
  }
});