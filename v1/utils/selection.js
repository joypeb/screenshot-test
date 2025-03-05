/**
 * selection.js
 * 웹페이지에서 요소 선택 및 하이라이트 기능을 위한 유틸리티
 */

// 요소 선택 핸들러 클래스
class ElementSelector {
  constructor(options = {}) {
    // 기본 옵션
    this.options = {
      highlightColor: 'rgba(52, 152, 219, 0.2)',
      borderColor: '#3498db',
      borderWidth: 2,
      borderStyle: 'dashed',
      zIndex: 2147483647, // 최대 z-index 값
      selectionCallback: null,
      escapeCallback: null,
      ...options
    };

    // 상태 변수
    this.active = false;
    this.highlightedElement = null;
    this.overlayElement = null;

    // 이벤트 핸들러 바인딩
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);

    // 알림 메시지 스타일
    this.notificationStyles = {
      position: 'fixed',
      top: '10px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px 15px',
      borderRadius: '5px',
      zIndex: this.options.zIndex,
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
      transition: 'opacity 0.3s ease',
      textAlign: 'center',
      maxWidth: '80%'
    };
  }

  /**
   * 선택 모드 시작
   * @param {string} message - 사용자에게 표시할 안내 메시지
   */
  start(message = '요소 위에 마우스를 올리고 클릭하세요. (ESC키로 취소)') {
    if (this.active) return;

    this.active = true;

    // 오버레이 요소 생성
    this.createOverlay();

    // 이벤트 리스너 등록
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('click', this.handleClick);
    document.addEventListener('keydown', this.handleKeyDown);

    // 안내 메시지 표시
    this.showNotification(message);

    // 마우스 커서 변경
    document.body.style.cursor = 'crosshair';
  }

  /**
   * 선택 모드 종료
   */
  stop() {
    if (!this.active) return;

    this.active = false;

    // 이벤트 리스너 제거
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('click', this.handleClick);
    document.removeEventListener('keydown', this.handleKeyDown);

    // 하이라이트 제거
    this.removeHighlight();

    // 오버레이 제거
    if (this.overlayElement) {
      document.body.removeChild(this.overlayElement);
      this.overlayElement = null;
    }

    // 마우스 커서 복원
    document.body.style.cursor = '';
  }

  /**
   * 오버레이 요소 생성
   */
  createOverlay() {
    this.overlayElement = document.createElement('div');

    // 오버레이 스타일 설정
    Object.assign(this.overlayElement.style, {
      position: 'absolute',
      pointerEvents: 'none',
      border: `${this.options.borderWidth}px ${this.options.borderStyle} ${this.options.borderColor}`,
      backgroundColor: this.options.highlightColor,
      zIndex: this.options.zIndex.toString(),
      display: 'none'
    });

    document.body.appendChild(this.overlayElement);
  }

  /**
   * 마우스 이동 이벤트 핸들러
   * @param {MouseEvent} e - 마우스 이벤트
   */
  handleMouseMove(e) {
    if (!this.active) return;

    // 마우스 아래 있는 요소 찾기
    const element = document.elementFromPoint(e.clientX, e.clientY);

    // body나 html 요소는 하이라이트하지 않음
    if (!element || element === document.body || element === document.documentElement) {
      this.removeHighlight();
      return;
    }

    // 이전과 같은 요소면 재계산하지 않음
    if (element === this.highlightedElement) return;

    // 새 요소 하이라이트
    this.highlightElement(element);
    this.highlightedElement = element;
  }

  /**
   * 요소 하이라이트
   * @param {HTMLElement} element - 하이라이트할 요소
   */
  highlightElement(element) {
    if (!element || !this.overlayElement) return;

    // 요소의 위치와 크기 계산
    const rect = element.getBoundingClientRect();

    // 계산된 스타일 가져오기
    const computedStyle = window.getComputedStyle(element);

    // 오버레이 위치와 크기 설정
    Object.assign(this.overlayElement.style, {
      left: `${window.scrollX + rect.left}px`,
      top: `${window.scrollY + rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      borderRadius: computedStyle.borderRadius,
      display: 'block'
    });
  }

  /**
   * 하이라이트 제거
   */
  removeHighlight() {
    if (this.overlayElement) {
      this.overlayElement.style.display = 'none';
    }
    this.highlightedElement = null;
  }

  /**
   * 요소 클릭 이벤트 핸들러
   * @param {MouseEvent} e - 마우스 이벤트
   */
  handleClick(e) {
    if (!this.active || !this.highlightedElement) return;

    // 이벤트 전파 방지
    e.preventDefault();
    e.stopPropagation();

    // 선택된 요소 정보 수집
    const selectedElement = this.highlightedElement;
    const rect = selectedElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(selectedElement);

    // 요소의 모양 결정 (직사각형, 원형, 타원 등)
    let shape = 'rectangle';
    if (computedStyle.borderRadius !== '0px') {
      if (rect.width === rect.height && computedStyle.borderRadius === '50%') {
        shape = 'circle';
      } else {
        shape = 'rounded';
      }
    }

    // 요소 정보 객체 생성
    const elementInfo = {
      element: selectedElement,
      left: rect.left + window.scrollX,
      top: rect.top + window.scrollY,
      width: rect.width,
      height: rect.height,
      borderRadius: computedStyle.borderRadius,
      shape: shape,
      scrollWidth: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth,
        document.documentElement.clientWidth
      ),
      scrollHeight: Math.max(
        document.documentElement.scrollHeight,
        document.body.scrollHeight,
        document.documentElement.clientHeight
      )
    };

    // 콜백 함수가 있으면 호출
    if (typeof this.options.selectionCallback === 'function') {
      this.options.selectionCallback(elementInfo);
    }

    // 선택 모드 종료
    this.stop();
  }

  /**
   * 키보드 이벤트 핸들러
   * @param {KeyboardEvent} e - 키보드 이벤트
   */
  handleKeyDown(e) {
    if (!this.active) return;

    // ESC 키 확인
    if (e.key === 'Escape') {
      // 콜백 함수가 있으면 호출
      if (typeof this.options.escapeCallback === 'function') {
        this.options.escapeCallback();
      }

      // 선택 모드 종료
      this.stop();

      // 취소 메시지 표시
      this.showNotification('스크린샷 모드가 취소되었습니다.');
    }
  }

  /**
   * 알림 메시지 표시
   * @param {string} message - 표시할 메시지
   * @param {number} duration - 표시 시간(ms)
   */
  showNotification(message, duration = 3000) {
    // 이전 알림이 있으면 제거
    const existingNotifications = document.querySelectorAll('.screenshot-notification');
    existingNotifications.forEach(node => {
      document.body.removeChild(node);
    });

    // 새 알림 요소 생성
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.className = 'screenshot-notification';

    // 스타일 적용
    Object.assign(notification.style, this.notificationStyles);

    // 문서에 추가
    document.body.appendChild(notification);

    // 지정된 시간 후 자동 제거
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, duration);
  }
}

/**
 * 선택기능을 이용한 스크린샷 모드 관리자
 */
class ScreenshotSelector {
  constructor(options = {}) {
    this.options = {
      highlightColor: 'rgba(52, 152, 219, 0.2)',
      borderColor: '#3498db',
      captureCallback: null,
      cancelCallback: null,
      ...options
    };

    // 선택기 인스턴스 생성
    this.selector = new ElementSelector({
      highlightColor: this.options.highlightColor,
      borderColor: this.options.borderColor,
      selectionCallback: this.handleElementSelected.bind(this),
      escapeCallback: this.handleCancel.bind(this)
    });
  }

  /**
   * 스크린샷 모드 시작
   */
  start() {
    this.selector.start('스크린샷 모드: 캡처할 영역 위에 마우스를 올리고 클릭하세요. (ESC키로 취소)');
  }

  /**
   * 스크린샷 모드 종료
   */
  stop() {
    this.selector.stop();
  }

  /**
   * 요소 선택 처리
   * @param {Object} elementInfo - 선택된 요소 정보
   */
  handleElementSelected(elementInfo) {
    if (typeof this.options.captureCallback === 'function') {
      this.options.captureCallback(elementInfo);
    }
  }

  /**
   * 취소 처리
   */
  handleCancel() {
    if (typeof this.options.cancelCallback === 'function') {
      this.options.cancelCallback();
    }
  }
}

/**
 * DOM 요소 관련 헬퍼 함수들
 */
const domUtils = {
  /**
   * 요소의 완전한 경로 계산
   * @param {HTMLElement} element - 대상 요소
   * @returns {string} 요소 경로 (ex: "body > div > ul > li:nth-child(3)")
   */
  getElementPath: (element) => {
    if (!element || element === document) return '';
    if (element === document.body) return 'body';

    let path = '';
    let currentElement = element;

    while (currentElement && currentElement !== document && currentElement !== document.body) {
      let selector = currentElement.tagName.toLowerCase();

      // ID가 있으면 추가
      if (currentElement.id) {
        selector += `#${currentElement.id}`;
      }
      // 클래스가 있으면 추가
      else if (currentElement.className) {
        selector += `.${Array.from(currentElement.classList).join('.')}`;
      }
      // 형제 요소들 중 순서 결정
      else {
        const siblings = Array.from(currentElement.parentNode.children);
        const index = siblings.indexOf(currentElement) + 1;
        if (siblings.length > 1) {
          selector += `:nth-child(${index})`;
        }
      }

      // 경로 앞에 추가
      path = selector + (path ? ' > ' + path : '');

      // 부모 요소로 이동
      currentElement = currentElement.parentElement;
    }

    // body 추가
    return 'body' + (path ? ' > ' + path : '');
  },

  /**
   * 경로로 요소 찾기
   * @param {string} path - 요소 경로
   * @returns {HTMLElement|null} 찾은 요소 또는 null
   */
  getElementByPath: (path) => {
    try {
      return document.querySelector(path);
    } catch (e) {
      console.error('Invalid selector path:', path);
      return null;
    }
  },

  /**
   * 요소의 계산된 스타일 속성 가져오기
   * @param {HTMLElement} element - 대상 요소
   * @returns {Object} 스타일 속성 객체
   */
  getElementStyles: (element) => {
    if (!element) return {};

    const computedStyle = window.getComputedStyle(element);
    const styles = {};

    // 중요한 스타일 속성들 추출
    const properties = [
      'borderTopLeftRadius', 'borderTopRightRadius',
      'borderBottomLeftRadius', 'borderBottomRightRadius',
      'backgroundColor', 'opacity',
      'overflow', 'visibility', 'display'
    ];

    properties.forEach(prop => {
      styles[prop] = computedStyle[prop];
    });

    return styles;
  }
};

// 내보내기
export {
  ElementSelector,
  ScreenshotSelector,
  domUtils
};