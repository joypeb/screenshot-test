/**
 * Smart Screenshot Extension - Popup Script
 * 팝업 UI 인터랙션 처리 및 다국어 지원
 */

const startButton = document.getElementById('startScreenshot');
const languageOptions = document.querySelectorAll('.language-option');

// 지원 언어 및 번역
const translations = {
  en: {
    title: 'Smart Screenshot',
    startScreenshot: 'Take Screenshot'
  },
  ko: {
    title: '스마트 스크린샷',
    startScreenshot: '스크린샷 시작'
  },
  ja: {
    title: 'スマートスクリーンショット',
    startScreenshot: 'スクリーンショット撮影'
  },
  zh: {
    title: '智能截图',
    startScreenshot: '开始截图'
  }
};

/**
 * 팝업 초기화
 */
function initPopup() {
  // 언어 설정 불러오기
  chrome.storage.local.get(['language'], (result) => {
    const currentLang = result.language || 'en';
    applyLanguage(currentLang);
    highlightSelectedLanguage(currentLang);
  });

  // 이벤트 리스너 설정
  startButton.addEventListener('click', startScreenshotMode);

  // 언어 선택 이벤트 리스너
  languageOptions.forEach(option => {
    option.addEventListener('click', () => {
      const lang = option.getAttribute('data-lang');
      chrome.storage.local.set({ language: lang }, () => {
        applyLanguage(lang);
        highlightSelectedLanguage(lang);
      });
    });
  });
}

/**
 * 선택된 언어 강조 표시
 */
function highlightSelectedLanguage(lang) {
  languageOptions.forEach(option => {
    if (option.getAttribute('data-lang') === lang) {
      option.classList.add('active');
    } else {
      option.classList.remove('active');
    }
  });
}

/**
 * 언어 적용
 */
function applyLanguage(lang) {
  const i18n = translations[lang] || translations.en;

  // 제목 업데이트
  document.getElementById('title').textContent = i18n.title;

  // 버튼 텍스트 업데이트
  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    element.textContent = i18n[key] || translations.en[key];
  });

  // 콘텐츠 스크립트에도 언어 변경 알림
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'languageChanged',
        language: lang
      }).catch(() => {
        // 콘텐츠 스크립트가 아직 로드되지 않았거나 오류 발생 시 무시
      });
    }
  });
}

/**
 * 현재 탭에서 스크린샷 모드 시작
 */
function startScreenshotMode() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    chrome.storage.local.set({ screenshotActive: true }, () => {
      chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        function: injectScreenshotMode
      });
      window.close();
    });
  });
}

/**
 * 웹 페이지 컨텍스트에서 실행될 함수
 */
function injectScreenshotMode() {
  chrome.runtime.sendMessage({ action: 'activateScreenshotMode' });
}

document.addEventListener('DOMContentLoaded', initPopup);