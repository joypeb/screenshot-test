// Smart Screenshot Content Script (Accurate Border & Exit Message Included)
(() => {
  // 상태 관리 객체
  const state = {
    isScreenshotModeActive: false,
    highlightedElement: null,
    overlayElement: null,
    observer: null,
  };

  // 스크롤 위치 저장을 위한 변수
  let originalScrollPosition = {
    x: 0,
    y: 0
  };

  /* ============================
     Exit Message 함수 (추가)
  ============================ */
  function showExitMessage() {
    const exitMessage = document.createElement('div');
    exitMessage.id = 'smart-screenshot-exit-message';
    Object.assign(exitMessage.style, {
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 20px',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      borderRadius: '50px',
      fontFamily: 'Segoe UI, sans-serif',
      fontSize: '14px',
      zIndex: '999999',
      opacity: '0',
      transition: 'opacity 0.3s ease'
    });
    exitMessage.textContent = '스크린샷 모드를 종료합니다';
    document.body.appendChild(exitMessage);
    // Fade in
    setTimeout(() => {
      exitMessage.style.opacity = '1';
    }, 10);
    // Fade out and remove
    setTimeout(() => {
      exitMessage.style.opacity = '0';
      setTimeout(() => {
        exitMessage.remove();
      }, 300);
    }, 2000);
  }

  /* ============================
     Helper: 정확한 rounded rectangle path 생성
     (x, y는 0,0으로 가정하고 width, height와 각 모서리 반지름 사용)
  ============================ */
  function generateRoundedRectPath(width, height, radii) {
    // radii: { topLeft, topRight, bottomRight, bottomLeft }
    return `
      M ${radii.topLeft},0
      H ${width - radii.topRight}
      ${radii.topRight > 0
        ? `A ${radii.topRight} ${radii.topRight} 0 0 1 ${width},${radii.topRight}`
        : ''}
      V ${height - radii.bottomRight}
      ${radii.bottomRight > 0
        ? `A ${radii.bottomRight} ${radii.bottomRight} 0 0 1 ${width
        - radii.bottomRight},${height}` : ''}
      H ${radii.bottomLeft}
      ${radii.bottomLeft > 0
        ? `A ${radii.bottomLeft} ${radii.bottomLeft} 0 0 1 0,${height
        - radii.bottomLeft}` : ''}
      V ${radii.topLeft}
      ${radii.topLeft > 0
        ? `A ${radii.topLeft} ${radii.topLeft} 0 0 1 ${radii.topLeft},0` : ''}
      Z
    `.trim().replace(/\s+/g, ' ');
  }

  /* ============================
     활성화 / 비활성화 함수
  ============================ */
  function activateScreenshotMode() {
    if (state.isScreenshotModeActive) {
      return;
    }
    state.isScreenshotModeActive = true;
    createOverlay();
    addEventListeners();
    setupMutationObserver();
    document.body.classList.add('smart-screenshot-mode');
    console.log('Screenshot mode activated');
  }

  function deactivateScreenshotMode() {
    if (!state.isScreenshotModeActive) {
      return;
    }
    state.isScreenshotModeActive = false;
    removeEventListeners();
    if (state.observer) {
      state.observer.disconnect();
      state.observer = null;
    }
    removeOverlay();
    document.body.classList.remove('smart-screenshot-mode');
    state.highlightedElement = null;
    console.log('Screenshot mode deactivated');
  }

  /* ============================
     이벤트 리스너 관리
  ============================ */
  function addEventListeners() {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('click', handleElementClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, {passive: true});
    document.addEventListener('click', captureAllClicks, true);
    handleATagClicks();
  }

  function removeEventListeners() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('click', handleElementClick);
    document.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('scroll', handleScroll);
  }

  function captureAllClicks(e) {
    if (state.isScreenshotModeActive && state.highlightedElement) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function handleATagClicks() {
    document.querySelectorAll('a').forEach(link => {
      const originalClick = link.onclick;
      link.onclick = function (e) {
        if (state.isScreenshotModeActive) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Link click prevented');
          return false;
        }
        if (originalClick) {
          return originalClick.call(this, e);
        }
      };
    });
  }

  /* ============================
     오버레이 생성/제거
  ============================ */
  function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'smart-screenshot-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '2147483647'
    });
    document.body.appendChild(overlay);
    state.overlayElement = overlay;
  }

  function removeOverlay() {
    if (state.overlayElement) {
      state.overlayElement.remove();
      state.overlayElement = null;
    }
  }

  /* ============================
     이벤트 핸들러
  ============================ */
  function handleMouseMove(event) {
    if (!state.isScreenshotModeActive) {
      return;
    }
    const targetElement = getTargetElement(event.clientX, event.clientY);
    if (!targetElement) {
      return;
    }

    if (isElementHighlightable(targetElement)) {
      highlightElement(targetElement);
    } else {
      let current = targetElement.parentElement;
      while (current && current !== document.body) {
        if (isElementHighlightable(current)) {
          highlightElement(current);
          break;
        }
        current = current.parentElement;
      }
    }
  }

  function handleScroll() {
    if (!state.isScreenshotModeActive || !state.highlightedElement) {
      return;
    }
    updateHighlightPosition();
  }

  function handleElementClick(event) {
  if (!state.isScreenshotModeActive || !state.highlightedElement) return;

  // 이벤트 기본 동작 및 전파 중지
  event.preventDefault();
  event.stopPropagation();

  console.log('Element clicked in screenshot mode:', state.highlightedElement);

  // 캡처 진행 알림 표시
  const notification = showCaptureNotification('캡처 요청 중...');

  // 요소 정보 수집
  const elementInfo = getDetailedElementInfo(state.highlightedElement);
  console.log('Element info collected:', elementInfo);

  // 메시지로 elementInfo 직접 전송 - 오류 처리 개선
  try {
    chrome.runtime.sendMessage({
      action: 'captureElementDirect',
      elementInfo: elementInfo
    }, function(response) {
      // lastError 확인 - 응답이 오지 않아도 오류 방지
      if (chrome.runtime.lastError) {
        console.log('Expected message port error (can be ignored):', chrome.runtime.lastError.message);
        // 백그라운드 스크립트에서 이미 처리 중이므로 추가 조치 불필요
        return;
      }

      // 정상 응답 처리
      if (response && response.success) {
        console.log('Capture message received confirmation:', response);
      } else if (response) {
        console.error('Capture request failed:', response.error || 'Unknown error');
        showCaptureNotification('캡처 요청 실패: ' + (response.error || '알 수 없는 오류'));
      }
    });
  } catch (error) {
    console.error('Error sending capture message:', error);
    showCaptureNotification('메시지 전송 오류: ' + error.message);
  }

  // 시각적 피드백 제공
  showCaptureAnimation(state.highlightedElement);

  return false;
}

  function handleKeyDown(event) {
    if (event.key === 'Escape' && state.isScreenshotModeActive) {
      deactivateScreenshotMode();
      showExitMessage();
      chrome.runtime.sendMessage({action: 'deactivateScreenshotMode'});
    }
  }

  /* ============================
     유틸리티 함수
  ============================ */
  function getTargetElement(x, y) {
    const elements = document.elementsFromPoint(x, y);
    return elements.find(
        el => el.id !== 'smart-screenshot-overlay' && !el.closest(
            '#smart-screenshot-highlight'));
  }

  function isElementHighlightable(element) {
    const rect = element.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      return false;
    }
    const style = window.getComputedStyle(element);
    if (style.opacity === '0' || style.display === 'none' || style.visibility
        === 'hidden') {
      return false;
    }
    if (element.closest('#smart-screenshot-overlay') || element.closest(
        '#smart-screenshot-highlight')) {
      return false;
    }
    if (element.tagName.toLowerCase() === 'svg' || element.closest(
        'svg')) {
      return false;
    }
    return true;
  }

  function highlightElement(element) {
    if (state.highlightedElement === element) {
      updateHighlightPosition();
      return;
    }
    state.highlightedElement = element;
    const shape = detectElementShape(element);
    clearHighlights();
    createHighlight(element, shape);
  }

  function updateHighlightPosition() {
    if (!state.highlightedElement) {
      return;
    }
    const highlight = document.getElementById('smart-screenshot-highlight');
    if (!highlight) {
      return;
    }
    const rect = state.highlightedElement.getBoundingClientRect();
    highlight.style.top = `${rect.top}px`;
    highlight.style.left = `${rect.left}px`;

    const darkOverlay = document.getElementById(
        'smart-screenshot-dark-overlay');
    if (darkOverlay) {
      const hole = darkOverlay.querySelector('.dark-overlay-hole');
      if (hole) {
        hole.style.top = `${rect.top}px`;
        hole.style.left = `${rect.left}px`;
      }
    }
    const svgContainers = highlight.querySelectorAll('.svg-border-container');
    svgContainers.forEach(container => {
      container.style.top = '0';
      container.style.left = '0';
    });
    const infoBox = highlight.querySelector('.smart-screenshot-info');
    if (infoBox) {
      const windowHeight = window.innerHeight;
      const elementTop = rect.top;
      const spaceBelow = windowHeight - (elementTop + rect.height);
      if (elementTop > 50) {
        infoBox.style.bottom = `${rect.height + 8}px`;
        infoBox.style.top = 'auto';
        infoBox.style.left = '50%';
        infoBox.style.transform = 'translateX(-50%)';
      } else if (spaceBelow > 50) {
        infoBox.style.top = `${rect.height + 8}px`;
        infoBox.style.bottom = 'auto';
        infoBox.style.left = '50%';
        infoBox.style.transform = 'translateX(-50%)';
      } else {
        infoBox.style.bottom = '8px';
        infoBox.style.right = '8px';
      }
    }
  }

  function clearHighlights() {
    document.querySelectorAll('.smart-screenshot-highlight').forEach(
        el => el.remove());
    const darkOverlay = document.getElementById(
        'smart-screenshot-dark-overlay');
    if (darkOverlay) {
      darkOverlay.remove();
    }
  }

  /* ============================
     모양 감지 (Shape Detection)
     - clip-path가 polygon, circle, ellipse 등인 경우를 파싱합니다.
     - 별도의 border-radius 값은 getComputedStyle을 통해 읽어옵니다.
  ============================ */
  function detectElementShape(element) {
    const computedStyle = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const borderRadius = {
      topLeft: parseFloat(computedStyle.borderTopLeftRadius) || 0,
      topRight: parseFloat(computedStyle.borderTopRightRadius) || 0,
      bottomRight: parseFloat(computedStyle.borderBottomRightRadius) || 0,
      bottomLeft: parseFloat(computedStyle.borderBottomLeftRadius) || 0,
    };
    const clipPathValue = (computedStyle.clipPath && computedStyle.clipPath
        !== 'none')
        ? computedStyle.clipPath
        : null;
    let shapeType = 'rectangle';
    let shapePath = null;
    if (clipPathValue) {
      if (clipPathValue.includes('polygon')) {
        shapeType = 'polygon';
        const match = clipPathValue.match(/polygon\(([^)]+)\)/);
        if (match && match[1]) {
          const points = match[1].split(',').map(p => p.trim());
          shapePath = {type: 'polygon', points: points};
        }
      } else if (clipPathValue.includes('circle')) {
        shapeType = 'circle';
        const match = clipPathValue.match(/circle\(([^)]+)\)/);
        if (match && match[1]) {
          shapePath = {type: 'circle', params: match[1].trim()};
        }
      } else if (clipPathValue.includes('ellipse')) {
        shapeType = 'ellipse';
        const match = clipPathValue.match(/ellipse\(([^)]+)\)/);
        if (match && match[1]) {
          shapePath = {type: 'ellipse', params: match[1].trim()};
        }
      } else if (clipPathValue.includes('inset')) {
        shapeType = 'clip-path';
        const match = clipPathValue.match(/inset\(([^)]+)\)/);
        if (match && match[1]) {
          shapePath = {type: 'inset', params: match[1].trim()};
        }
      } else if (clipPathValue.includes('path')) {
        shapeType = 'clip-path';
        const match = clipPathValue.match(/path\(["']([^"']+)["']\)/);
        if (match && match[1]) {
          shapePath = {type: 'path', d: match[1]};
        }
      }
    } else {
      // 단순 border-radius만 있을 경우, 모든 값이 0이면 rectangle, 아니면 rounded로 처리
      if (borderRadius.topLeft || borderRadius.topRight
          || borderRadius.bottomRight || borderRadius.bottomLeft) {
        shapeType = 'rounded';
      }
    }
    return {
      type: shapeType,
      width: rect.width,
      height: rect.height,
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      viewportTop: rect.top,
      viewportLeft: rect.left,
      borderRadius: borderRadius,
      clipPath: clipPathValue,
      shapePath: shapePath,
      element: element
    };
  }

  /* ============================
     하이라이트 및 테두리 생성
  ============================ */
  function createHighlight(element, shape) {
    const highlight = document.createElement('div');
    highlight.className = 'smart-screenshot-highlight';
    highlight.id = 'smart-screenshot-highlight';
    Object.assign(highlight.style, {
      position: 'fixed',
      top: `${shape.viewportTop}px`,
      left: `${shape.viewportLeft}px`,
      width: `${shape.width}px`,
      height: `${shape.height}px`,
      pointerEvents: 'auto',
      zIndex: '2147483646',
      boxShadow: 'none',
      border: 'none',
      background: 'transparent'
    });

    // 수정된 클릭 이벤트 핸들러
    highlight.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      console.log('Highlight element clicked for capture');

      const notification = showCaptureNotification('캡처 요청 중...');
      const elementInfo = getDetailedElementInfo(element);

      chrome.runtime.sendMessage({
        action: 'captureElementDirect',
        elementInfo: elementInfo
      }, function (response) {
        if (chrome.runtime.lastError) {
          console.error('Error sending capture message:',
              chrome.runtime.lastError);
          showCaptureNotification(
              '메시지 전송 오류: ' + chrome.runtime.lastError.message);
          return;
        }

        if (!response || !response.success) {
          showCaptureNotification(
              '캡처 요청 실패: ' + (response?.error || '알 수 없는 오류'));
        }
      });

      showCaptureAnimation(element);
      return false;
    });

    createBorderByShapeType(highlight, shape);
    highlight.dataset.shapeType = shape.type;
    highlight.dataset.elementSelector = getUniqueSelector(element);
    createDarkOverlay(shape);
    addInfoBox(highlight, shape);
    state.overlayElement.appendChild(highlight);
  }

  function createBorderByShapeType(container, shape) {
    switch (shape.type) {
      case 'rectangle':
        createRectangleBorder(container, shape);
        break;
      case 'rounded':
        createRoundedRectangleBorder(container, shape);
        break;
      case 'circle':
      case 'ellipse':
        createCircleBorder(container, shape);
        break;
      case 'polygon':
        createPolygonBorder(container, shape);
        break;
      case 'clip-path':
      case 'svg':
      case 'svg-path':
      case 'svg-polygon':
      case 'svg-circle':
      case 'svg-ellipse':
      case 'svg-rect':
        createSvgBorder(container, shape);
        break;
      default:
        createRectangleBorder(container, shape);
    }
  }

  function createRectangleBorder(container, shape) {
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    Object.assign(svg.style,
        {position: 'absolute', top: '0', left: '0', overflow: 'visible'});
    // 기본 그라데이션
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', 'border-gradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animate = document.createElementNS('http://www.w3.org/2000/svg',
        'animate');
    animate.setAttribute('attributeName', 'x1');
    animate.setAttribute('from', '-100%');
    animate.setAttribute('to', '100%');
    animate.setAttribute('dur', '3s');
    animate.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animate);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '0');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', 'url(#border-gradient)');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('stroke-dasharray', '6,3');
    svg.appendChild(rect);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
  }

  function createRoundedRectangleBorder(container, shape) {
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    Object.assign(svg.style,
        {position: 'absolute', top: '0', left: '0', overflow: 'visible'});
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    // 고유 그라데이션 ID 생성
    const gradientId = `border-gradient-${Date.now()}`;
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', gradientId);
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animate = document.createElementNS('http://www.w3.org/2000/svg',
        'animate');
    animate.setAttribute('attributeName', 'x1');
    animate.setAttribute('from', '-100%');
    animate.setAttribute('to', '100%');
    animate.setAttribute('dur', '3s');
    animate.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animate);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);
    // 정확한 rounded rectangle 경로 생성 (좌표 0,0 기준)
    const pathData = generateRoundedRectPath(shape.width, shape.height,
        shape.borderRadius);
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', `url(#${gradientId})`);
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-dasharray', '6,3');
    svg.appendChild(path);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
  }

  function createCircleBorder(container, shape) {
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    Object.assign(svg.style,
        {position: 'absolute', top: '0', left: '0', overflow: 'visible'});
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradientId = `border-gradient-${Date.now()}`;
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', gradientId);
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animateTransform = document.createElementNS(
        'http://www.w3.org/2000/svg', 'animateTransform');
    animateTransform.setAttribute('attributeName', 'gradientTransform');
    animateTransform.setAttribute('type', 'rotate');
    animateTransform.setAttribute('from', '0 0.5 0.5');
    animateTransform.setAttribute('to', '360 0.5 0.5');
    animateTransform.setAttribute('dur', '8s');
    animateTransform.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animateTransform);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);
    if (shape.type === 'ellipse') {
      const ellipse = document.createElementNS('http://www.w3.org/2000/svg',
          'ellipse');
      ellipse.setAttribute('cx', '50%');
      ellipse.setAttribute('cy', '50%');
      ellipse.setAttribute('rx', '49%');
      ellipse.setAttribute('ry', '49%');
      ellipse.setAttribute('fill', 'none');
      ellipse.setAttribute('stroke', `url(#${gradientId})`);
      ellipse.setAttribute('stroke-width', '2');
      ellipse.setAttribute('stroke-dasharray', '6,3');
      svg.appendChild(ellipse);
    } else {
      const circle = document.createElementNS('http://www.w3.org/2000/svg',
          'circle');
      circle.setAttribute('cx', '50%');
      circle.setAttribute('cy', '50%');
      circle.setAttribute('r', '49%');
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', `url(#${gradientId})`);
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('stroke-dasharray', '6,3');
      const animateTransformCircle = document.createElementNS(
          'http://www.w3.org/2000/svg', 'animateTransform');
      animateTransformCircle.setAttribute('attributeName', 'transform');
      animateTransformCircle.setAttribute('type', 'rotate');
      animateTransformCircle.setAttribute('from', '0 50% 50%');
      animateTransformCircle.setAttribute('to', '360 50% 50%');
      animateTransformCircle.setAttribute('dur', '20s');
      animateTransformCircle.setAttribute('repeatCount', 'indefinite');
      circle.appendChild(animateTransformCircle);
      svg.appendChild(circle);
    }
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
  }

  // 다각형(Polygon) 테두리 생성 (clip-path: polygon)
  function createPolygonBorder(container, shape) {
    if (!shape.shapePath || !shape.shapePath.points) {
      return;
    }
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    Object.assign(svg.style,
        {position: 'absolute', top: '0', left: '0', overflow: 'visible'});
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradientId = `polygon-gradient-${Date.now()}`;
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', gradientId);
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animate = document.createElementNS('http://www.w3.org/2000/svg',
        'animate');
    animate.setAttribute('attributeName', 'x1');
    animate.setAttribute('from', '-100%');
    animate.setAttribute('to', '100%');
    animate.setAttribute('dur', '3s');
    animate.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animate);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);
    const polygon = document.createElementNS('http://www.w3.org/2000/svg',
        'polygon');
    polygon.setAttribute('points', shape.shapePath.points.join(' '));
    polygon.setAttribute('fill', 'none');
    polygon.setAttribute('stroke', `url(#${gradientId})`);
    polygon.setAttribute('stroke-width', '2');
    polygon.setAttribute('stroke-dasharray', '6,3');
    svg.appendChild(polygon);
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
  }

  function createClipPathBorder(container, shape) {
    if (!shape.clipPath) {
      return;
    }
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    Object.assign(svg.style,
        {position: 'absolute', top: '0', left: '0', overflow: 'visible'});
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const gradientId = `clip-gradient-${Date.now()}`;
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', gradientId);
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animate = document.createElementNS('http://www.w3.org/2000/svg',
        'animate');
    animate.setAttribute('attributeName', 'x1');
    animate.setAttribute('from', '-100%');
    animate.setAttribute('to', '100%');
    animate.setAttribute('dur', '3s');
    animate.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animate);
    defs.appendChild(linearGradient);
    svg.appendChild(defs);
    const clipElement = document.createElement('div');
    clipElement.className = 'smart-screenshot-clip-border';
    Object.assign(clipElement.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      clipPath: shape.clipPath,
      boxSizing: 'border-box'
    });
    if (shape.shapePath) {
      let path;
      if (shape.shapePath.type === 'polygon' && shape.shapePath.points) {
        path = document.createElementNS('http://www.w3.org/2000/svg',
            'polygon');
        path.setAttribute('points', shape.shapePath.points.join(' '));
      } else if (shape.shapePath.type === 'circle' && shape.shapePath.params) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        const params = shape.shapePath.params.split(' ');
        if (params.length === 2) {
          path.setAttribute('r', params[0]);
          path.setAttribute('cx', '50%');
          path.setAttribute('cy', '50%');
        }
      } else if (shape.shapePath.type === 'ellipse' && shape.shapePath.params) {
        path = document.createElementNS('http://www.w3.org/2000/svg',
            'ellipse');
        const params = shape.shapePath.params.split(' ');
        if (params.length >= 2) {
          path.setAttribute('rx', params[0]);
          path.setAttribute('ry', params[1]);
          path.setAttribute('cx', '50%');
          path.setAttribute('cy', '50%');
        }
      } else if (shape.shapePath.type === 'inset' && shape.shapePath.params) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        path.setAttribute('x', '0');
        path.setAttribute('y', '0');
        path.setAttribute('width', '100%');
        path.setAttribute('height', '100%');
      } else if (shape.shapePath.type === 'path' && shape.shapePath.d) {
        path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', shape.shapePath.d);
      }
      if (path) {
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', `url(#${gradientId})`);
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '6,3');
        svg.appendChild(path);
      }
    }
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
    container.appendChild(clipElement);
  }

  function createSvgBorder(container, shape) {
    if (!shape.element) {
      return;
    }
    const boundingBox = {
      width: shape.width,
      height: shape.height,
      maxSize: Math.max(shape.width, shape.height) * 3
    };
    const svgContainer = document.createElement('div');
    svgContainer.className = 'svg-border-container';
    let svg;
    if (shape.element.tagName.toLowerCase() === 'svg') {
      svg = shape.element.cloneNode(false);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`);
      svg.style.overflow = 'visible';
      Array.from(shape.element.children).forEach(child => {
        if (['path', 'rect', 'circle', 'ellipse', 'polygon',
          'polyline'].includes(child.tagName.toLowerCase())) {
          svg.appendChild(child.cloneNode(true));
        }
      });
    } else if (shape.element.closest('svg')) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', `0 0 ${shape.width} ${shape.height}`);
      svg.style.overflow = 'visible';
      const clone = shape.element.cloneNode(true);
      clone.removeAttribute('transform');
      svg.appendChild(clone);
    } else {
      return;
    }
    const allShapes = svg.querySelectorAll('*');
    allShapes.forEach(el => {
      let isTooLarge = false;
      try {
        if (typeof el.getBBox === 'function') {
          const bbox = el.getBBox();
          if (bbox.width > boundingBox.maxSize || bbox.height
              > boundingBox.maxSize) {
            isTooLarge = true;
            console.warn('Oversized SVG element detected', el);
          }
        }
      } catch (e) {
      }
      if (isTooLarge) {
        el.setAttribute('transform', 'scale(0.1)');
      } else {
        const originalFill = el.getAttribute('fill');
        if (['path', 'rect', 'circle', 'ellipse', 'polygon',
          'polyline'].includes(el.tagName.toLowerCase())) {
          if (originalFill && originalFill !== 'none') {
            el.setAttribute('data-original-fill', originalFill);
          }
          el.setAttribute('fill', 'none');
          el.setAttribute('stroke', 'url(#svg-gradient)');
          el.setAttribute('stroke-width', '2');
          el.setAttribute('stroke-dasharray', '6,3');
        }
      }
    });
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const linearGradient = document.createElementNS(
        'http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', 'svg-gradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '100%');
    linearGradient.setAttribute('y2', '0%');
    const colors = ['#6366f1', '#8b5cf6', '#d946ef', '#f97316', '#d946ef',
      '#8b5cf6', '#6366f1'];
    colors.forEach((color, i) => {
      const stop = document.createElementNS('http://www.w3.org/2000/svg',
          'stop');
      stop.setAttribute('offset', `${i * (100 / (colors.length - 1))}%`);
      stop.setAttribute('stop-color', color);
      linearGradient.appendChild(stop);
    });
    const animate = document.createElementNS('http://www.w3.org/2000/svg',
        'animate');
    animate.setAttribute('attributeName', 'x1');
    animate.setAttribute('from', '-100%');
    animate.setAttribute('to', '100%');
    animate.setAttribute('dur', '3s');
    animate.setAttribute('repeatCount', 'indefinite');
    linearGradient.appendChild(animate);
    defs.appendChild(linearGradient);
    if (!svg.querySelector('defs')) {
      svg.insertBefore(defs, svg.firstChild);
    } else {
      const existingDefs = svg.querySelector('defs');
      existingDefs.appendChild(linearGradient);
    }
    svgContainer.style.maxWidth = '100%';
    svgContainer.style.maxHeight = '100%';
    svgContainer.style.overflow = 'hidden';
    svgContainer.appendChild(svg);
    container.appendChild(svgContainer);
    setTimeout(() => {
      const svgRect = svg.getBoundingClientRect();
      if (svgRect.width > boundingBox.maxSize || svgRect.height
          > boundingBox.maxSize) {
        console.warn('SVG border too large, falling back to rectangle border');
        svgContainer.remove();
        createRectangleBorder(container, shape);
      }
    }, 50);
  }

  /* ============================
     어두운 오버레이 및 안내 박스
  ============================ */
  function createDarkOverlay(shape) {
    const existing = document.getElementById('smart-screenshot-dark-overlay');
    if (existing) {
      existing.remove();
    }
    const overlay = document.createElement('div');
    overlay.id = 'smart-screenshot-dark-overlay';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(0,0,0,0.2)',
      zIndex: '2147483645',
      pointerEvents: 'none'
    });
    const hole = document.createElement('div');
    hole.className = 'dark-overlay-hole';
    Object.assign(hole.style, {
      position: 'absolute',
      top: `${shape.viewportTop}px`,
      left: `${shape.viewportLeft}px`,
      width: `${shape.width}px`,
      height: `${shape.height}px`,
      backgroundColor: 'transparent',
      boxShadow: '0 0 0 9999px rgba(0,0,0,0.2)'
    });
    if (shape.type === 'circle' || shape.type === 'ellipse') {
      hole.style.borderRadius = '50%';
    } else if (shape.type === 'rounded') {
      const br = shape.borderRadius;
      hole.style.borderRadius = `${br.topLeft}px ${br.topRight}px ${br.bottomRight}px ${br.bottomLeft}px`;
    } else if ((shape.type === 'polygon' || shape.type === 'clip-path')
        && shape.clipPath) {
      hole.style.clipPath = shape.clipPath;
    }
    overlay.appendChild(hole);
    state.overlayElement.appendChild(overlay);
  }

  function addInfoBox(container, shape) {
    const infoBox = document.createElement('div');
    infoBox.className = 'smart-screenshot-info';
    infoBox.textContent = 'Click to capture this element';
    Object.assign(infoBox.style, {
      position: 'absolute',
      padding: '6px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      fontFamily: 'Segoe UI, sans-serif',
      color: 'white',
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      zIndex: '2147483647',
      pointerEvents: 'none',
      transition: 'opacity 0.2s ease',
      opacity: '0'
    });
    const windowHeight = window.innerHeight;
    const elementTop = shape.viewportTop;
    const spaceBelow = windowHeight - (elementTop + shape.height);
    if (elementTop > 50) {
      infoBox.style.bottom = `${shape.height + 8}px`;
      infoBox.style.left = '50%';
      infoBox.style.transform = 'translateX(-50%)';
    } else if (spaceBelow > 50) {
      infoBox.style.top = `${shape.height + 8}px`;
      infoBox.style.left = '50%';
      infoBox.style.transform = 'translateX(-50%)';
    } else {
      infoBox.style.bottom = '8px';
      infoBox.style.right = '8px';
    }
    container.appendChild(infoBox);
    setTimeout(() => {
      infoBox.style.opacity = '1';
    }, 300);
  }

  function showCaptureAnimation(element) {
    const rect = element.getBoundingClientRect();
    const animation = document.createElement('div');
    animation.className = 'smart-screenshot-capture-animation';
    Object.assign(animation.style, {
      position: 'fixed',
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      backgroundColor: 'rgba(255,255,255,0.3)',
      border: '2px dashed #8b5cf6',
      borderRadius: window.getComputedStyle(element).borderRadius,
      zIndex: '2147483646',
      animation: 'screenshot-capture-flash 0.5s ease-out forwards',
      pointerEvents: 'none'
    });
    state.overlayElement.appendChild(animation);
    setTimeout(() => {
      animation.remove();
    }, 500);
  }

  function getUniqueSelector(element) {
    if (element.id) {
      return `#${element.id}`;
    }
    let path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector = `#${current.id}`;
        path.unshift(selector);
        break;
      }
      if (current.parentElement) {
        const siblings = Array.from(current.parentElement.children)
        .filter(child => child.tagName === current.tagName);
        if (siblings.length > 1) {
          const index = siblings.indexOf(current);
          selector += `:nth-child(${index + 1})`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
    }
    return path.join(' > ');
  }

  function setupMutationObserver() {
    state.observer = new MutationObserver(() => {
      if (state.highlightedElement && !document.contains(
          state.highlightedElement)) {
        state.highlightedElement = null;
        clearHighlights();
      }
    });
    state.observer.observe(document.body, {childList: true, subtree: true});
  }

  /* ============================
     캡처 관련 새로 추가된 함수들
  ============================ */

  // 선택자로 요소 가져오기
  function getElementBySelector(selector) {
    try {
      return document.querySelector(selector);
    } catch (e) {
      console.error('Invalid selector:', selector);
      return null;
    }
  }

  // 요소에 대한 상세 정보 수집
  function getDetailedElementInfo(element) {
    // 요소의 위치와 크기 정보
    const rect = element.getBoundingClientRect();

    // 요소의 스크롤 가능한 높이 계산
    const computedStyle = window.getComputedStyle(element);
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);
    const borderTop = parseFloat(computedStyle.borderTopWidth);
    const borderBottom = parseFloat(computedStyle.borderBottomWidth);

    // 스크롤 고려한 실제 높이
    const scrollHeight = element.scrollHeight;
    const clientHeight = element.clientHeight;
    const totalHeight = Math.max(scrollHeight, rect.height);

    // 모양 정보 (기존 detectElementShape 함수 활용)
    const shape = detectElementShape(element);

    // 화면 정보
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 디바이스 픽셀 비율 (고해상도 캡처를 위함)
    const devicePixelRatio = window.devicePixelRatio || 1;

    return {
      selector: getUniqueSelector(element),
      tagName: element.tagName,
      boundingRect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      },
      scrollTop: window.pageYOffset,
      scrollLeft: window.pageXOffset,
      totalWidth: rect.width,
      totalHeight: totalHeight,
      scrollHeight: scrollHeight,
      clientHeight: clientHeight,
      viewportWidth: viewportWidth,
      viewportHeight: viewportHeight,
      devicePixelRatio: devicePixelRatio,
      shape: {
        type: shape.type,
        borderRadius: shape.borderRadius,
        clipPath: shape.clipPath,
        shapePath: shape.shapePath
      }
    };
  }

  // 캡처 알림 표시
  function showCaptureNotification(message) {
    // 이미 존재하는 알림 제거
    const existingNotifications = document.querySelectorAll(
        '.smart-screenshot-notification');
    existingNotifications.forEach(note => {
      note.style.opacity = '0';
      setTimeout(() => note.remove(), 300);
    });

    const notification = document.createElement('div');
    notification.className = 'smart-screenshot-notification';

    // 진행 중 여부에 따른 스타일 구분
    const isProcessing = message.includes('처리 중');

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.85);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: 'Segoe UI', sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      transition: opacity 0.3s ease;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    // 아이콘 추가
    const icon = document.createElement('span');
    icon.style.cssText = `
      font-size: 16px;
      margin-right: 5px;
    `;

    // 진행 중이면 로딩 아이콘, 아니면 체크 아이콘
    if (isProcessing) {
      icon.textContent = '⏳';
      notification.style.borderLeft = '3px solid #3b82f6';
    } else if (message.includes('완료')) {
      icon.textContent = '✅';
      notification.style.borderLeft = '3px solid #10b981';
    } else if (message.includes('오류')) {
      icon.textContent = '❌';
      notification.style.borderLeft = '3px solid #ef4444';
    } else {
      icon.textContent = 'ℹ️';
      notification.style.borderLeft = '3px solid #8b5cf6';
    }

    notification.appendChild(icon);
    notification.appendChild(document.createTextNode(message));
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    // Fade out and remove (진행 중일 때는 시간 늘림)
    const displayTime = isProcessing ? 10000 : 4000;
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, displayTime);

    return notification;
  }

  // SVG 마스크를 사용한 고급 요소 캡처 준비 (복잡한 모양을 위함)
  function prepareElementForCapture(element, shape) {
    // 이미 처리된 요소는 건너뜀
    if (element.dataset.preparedForCapture) {
      return;
    }

    // 요소에 마킹
    element.dataset.preparedForCapture = 'true';

    if (shape.type === 'clip-path' || shape.type === 'polygon') {
      // SVG 클립 패스를 위한 추가 준비가 필요할 수 있음
      // 이 부분은 구체적인 요구사항에 따라 구현
    }
  }

  // 깊이 중첩된 요소도 정확히 캡처할 수 있도록 처리
  function processChildElements(element) {
    // Shadow DOM 확인
    if (element.shadowRoot) {
      // Shadow DOM 내부의 요소 처리 (추가 구현 필요)
    }

    // iframe 내부의 요소 처리
    const iframes = element.querySelectorAll('iframe');
    iframes.forEach(iframe => {
      try {
        // 동일 출처 정책으로 인해 접근 제한될 수 있음
        const iframeDoc = iframe.contentDocument
            || iframe.contentWindow.document;
        // iframe 내부 요소 처리 (추가 구현 필요)
      } catch (e) {
        console.log('Cannot access iframe content:', e);
      }
    });
  }

  /* ============================
     Chrome 메시지 수신
  ============================ */
 chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 메시지 수신 로그
  console.log('Content script received message:', request.action);

  if (request.action === 'activateScreenshotMode') {
    activateScreenshotMode();
    // 항상 응답 전송
    sendResponse({ success: true });
    return false; // 비동기 응답이 없으므로 false 반환
  }
  else if (request.action === 'deactivateScreenshotMode') {
    deactivateScreenshotMode();
    // 항상 응답 전송
    sendResponse({ success: true });
    return false; // 비동기 응답이 없으므로 false 반환
  }
  else if (request.action === 'getElementInfo') {
    if (!request.elementSelector) {
      sendResponse({ success: false, error: 'No selector provided' });
      return false;
    }

    try {
      const element = getElementBySelector(request.elementSelector);
      if (!element) {
        sendResponse({ success: false, error: 'Element not found' });
        return false;
      }

      const elementInfo = getDetailedElementInfo(element);
      sendResponse({ success: true, elementInfo: elementInfo });
    } catch (error) {
      console.error('Error getting element info:', error);
      sendResponse({ success: false, error: error.message });
    }
    return false; // 비동기 응답이 없으므로 false 반환
  }
  else if (request.action === 'saveScrollPosition') {
    try {
      originalScrollPosition = {
        x: window.pageXOffset,
        y: window.pageYOffset
      };
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  else if (request.action === 'restoreScrollPosition') {
    try {
      window.scrollTo(originalScrollPosition.x, originalScrollPosition.y);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }
  else if (request.action === 'scrollToPosition') {
    try {
      window.scrollTo(window.pageXOffset, request.scrollTop);
      // 스크롤 안정화를 위한 짧은 지연
      setTimeout(() => {
        sendResponse({ success: true });
      }, 50);
      return true; // 비동기 응답을 위해 true 반환
    } catch (error) {
      sendResponse({ success: false, error: error.message });
      return false;
    }
  }
  else if (request.action === 'showNotification') {
    try {
      showCaptureNotification(request.message);
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
    return false;
  }

  // 알 수 없는 액션에도 항상 응답
  sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  return false;
});
})();