(async function () {
  console.log("Content script loaded");

  let currentElement = null;

  // 오버레이(highlighter) 요소 생성 (마우스 오버 시 선택 대상 표시)
  const overlay = document.createElement('div');
  overlay.style.position = 'absolute';
  overlay.style.pointerEvents = 'none'; // 클릭에 영향 주지 않음
  overlay.style.border = '2px solid red';
  overlay.style.zIndex = '9999';
  overlay.style.transition = 'all 0.1s ease-out';
  document.body.appendChild(overlay);

  let ticking = false;

  // 중첩된 스크롤 컨테이너를 고려한 절대 위치 계산 함수
  function getAbsolutePosition(element) {
    let rect = element.getBoundingClientRect();
    let scrollX = window.scrollX;
    let scrollY = window.scrollY;

    // 모든 부모 스크롤 컨테이너의 스크롤 위치를 고려
    let parent = element.parentElement;
    while (parent) {
      if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) {
        scrollX += parent.scrollLeft;
        scrollY += parent.scrollTop;
      }
      parent = parent.parentElement;
    }

    return {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + scrollY,
      right: rect.right + scrollX
    };
  }

  // 브라우저 확대/축소 수준 얻기
  function getBrowserZoom() {
    return Math.round((window.outerWidth / window.innerWidth) * 100) / 100;
  }

  // 마우스 이동 시, 화면상에 있는 요소를 기반으로 오버레이 업데이트
  function updateOverlay(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) {
      overlay.style.display = 'none';
      currentElement = null;
      ticking = false;
      return;
    }

    // 원하는 태그만 선택 (필요 시 확장 가능)
    const tag = el.tagName.toLowerCase();
    if (tag === 'div' || tag === 'a') {
      currentElement = el;
      const rect = el.getBoundingClientRect();
      const position = getAbsolutePosition(el);

      overlay.style.top = position.top + 'px';
      overlay.style.left = position.left + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';

      const computedStyle = window.getComputedStyle(el);
      overlay.style.borderRadius = computedStyle.borderRadius;
      overlay.style.display = 'block';
    } else {
      overlay.style.display = 'none';
      currentElement = null;
    }
    ticking = false;
  }

  function onMouseMove(e) {
    if (!ticking) {
      window.requestAnimationFrame(() => updateOverlay(e));
      ticking = true;
    }
  }

  document.addEventListener('mousemove', onMouseMove);

  // DOM 렌더링 완료 대기 함수
  async function waitForDOMStability(duration = 500) {
    // 초기 DOM 상태 저장
    const initialState = document.body.innerHTML;

    return new Promise(resolve => {
      // 일정 시간 후 DOM이 안정화되었는지 확인
      setTimeout(() => {
        // 현재 DOM 상태와 비교
        const currentState = document.body.innerHTML;
        if (currentState === initialState) {
          resolve();
        } else {
          // DOM이 변경되었다면 다시 대기
          setTimeout(resolve, duration / 2);
        }
      }, duration);
    });
  }

  // 클릭 이벤트: 클릭 시점에 실제 화면상 요소를 재탐색하여 캡처 진행
  document.addEventListener('click', async function (e) {
    e.preventDefault();
    console.log("Click event fired. Re-searching element...");

    // 클릭 시점에서 실제 화면상의 요소를 다시 탐색
    let targetElement = document.elementFromPoint(e.clientX, e.clientY);
    if (targetElement && targetElement.nodeType !== Node.ELEMENT_NODE) {
      targetElement = targetElement.parentElement;
    }
    if (!targetElement) {
      console.error("유효한 요소를 찾을 수 없습니다.");
      return;
    }

    console.log("Target element:", targetElement);

    // 브라우저 확대/축소 수준 확인
    const zoomLevel = getBrowserZoom();
    console.log("Browser zoom level:", zoomLevel);

    // 요소의 정확한 절대 위치 및 크기 계산
    const position = getAbsolutePosition(targetElement);
    const elementAbsoluteTop = position.top;
    const elementAbsoluteLeft = position.left;
    const elementWidth = position.width;
    const elementHeight = position.height;
    const elementAbsoluteBottom = position.bottom;

    // 해상도 보정을 위한 scale (devicePixelRatio 고려)
    const deviceScale = window.devicePixelRatio;
    console.log("Device Pixel Ratio:", deviceScale);

    // 최종 스케일 계산 (기기 픽셀 비율 및 브라우저 확대/축소 고려)
    const scale = deviceScale * zoomLevel;
    console.log("Final scale factor:", scale);

    // 뷰포트 높이 (세로 캡처 단위)
    const viewportHeight = window.innerHeight;

    // 요소가 걸쳐있는 뷰포트 세그먼트 계산
    const startSegment = Math.floor(elementAbsoluteTop / viewportHeight);
    const endSegment = Math.ceil(elementAbsoluteBottom / viewportHeight);
    const segments = endSegment - startSegment;
    console.log(`Capturing element across ${segments} segments`);

    // 최종 스티칭할 캔버스 생성 (요소 전체 크기에 맞춤)
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = elementWidth * scale;
    finalCanvas.height = elementHeight * scale;
    const finalCtx = finalCanvas.getContext('2d');

    // 캡처 전에 오버레이 숨김 (테두리가 포함되지 않도록)
    const prevDisplay = overlay.style.display;
    overlay.style.display = 'none';

    // targetElement의 border-radius (첫 번째 값 사용)
    const computedStyle = window.getComputedStyle(targetElement);
    const borderRadius = parseFloat(computedStyle.borderRadius) || 0;

    // 각 세그먼트를 순차 캡처하여 최종 캔버스에 스티칭
    for (let seg = startSegment; seg < endSegment; seg++) {
      // 현재 세그먼트의 시작 scrollY 값 (문서 기준)
      const segmentScrollY = seg * viewportHeight;
      console.log(`Scrolling to Y: ${segmentScrollY}px (segment ${seg + 1}/${endSegment})`);
      window.scrollTo(0, segmentScrollY);

      // 스크롤 후 DOM이 안정화될 때까지 대기 (최소 500ms)
      await waitForDOMStability(500);

      // 현재 뷰포트의 전체 스크린샷 캡처
      console.log("Capturing current viewport");
      const response = await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'captureVisibleTab' }, resolve);
      });

      if (!response || response.error) {
        console.error("캡처 실패:", response ? response.error : "Unknown error");
        overlay.style.display = prevDisplay;
        return;
      }

      // 이미지 객체 생성 및 로드 대기
      console.log("Processing captured segment...");
      const segmentImg = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = response.dataUrl;
      });

      // 현재 스크롤 위치 다시 확인 (캡처 중 변경되었을 수 있음)
      const currentScrollX = window.scrollX;
      const currentScrollY = window.scrollY;

      // 해당 세그먼트에서 targetElement가 실제로 보이는 영역 계산
      // 스크롤 위치가 바뀌었을 수 있으므로 현재 위치 기준으로 다시 계산
      const updatedPosition = getAbsolutePosition(targetElement);
      const elementScreenTop = updatedPosition.top - currentScrollY;
      const elementScreenLeft = updatedPosition.left - currentScrollX;

      // 해당 세그먼트에서 요소의 보이는 부분 계산
      const visibleTop = Math.max(0, elementScreenTop);
      const visibleBottom = Math.min(viewportHeight, elementScreenTop + elementHeight);

      if (visibleBottom <= visibleTop) {
        console.log("Element not visible in this segment, skipping");
        continue; // 해당 세그먼트에 요소가 없음
      }

      // 뷰포트 내에서의 크롭 좌표 및 크기
      const cropX = Math.max(0, elementScreenLeft);
      const cropY = visibleTop;
      const cropWidth = Math.min(elementWidth, window.innerWidth - cropX);
      const cropHeight = visibleBottom - visibleTop;

      // 최종 캔버스에 그릴 위치 (전체 요소 기준으로 상대적 위치)
      const segmentOffset = currentScrollY - elementAbsoluteTop + visibleTop;
      const destY = Math.max(0, segmentOffset);
      const destX = 0; // 요소의 왼쪽부터 시작

      console.log(`Drawing segment - Source: (${cropX}x${cropY}, ${cropWidth}x${cropHeight}) -> Dest: (${destX}x${destY})`);

      // 최종 캔버스에 현재 세그먼트 이미지의 해당 부분 그리기 (해상도 보정 적용)
      finalCtx.drawImage(
        segmentImg,
        cropX * scale, cropY * scale, cropWidth * scale, cropHeight * scale, // 소스 영역
        destX, destY * scale, cropWidth * scale, cropHeight * scale          // 대상 영역
      );
    }

    // 원래 스크롤 위치로 복원
    window.scrollTo(0, elementAbsoluteTop);

    // 오버레이 복원
    overlay.style.display = prevDisplay;

    console.log("Creating final image with applied border-radius");
    // 클리핑 처리: targetElement의 border-radius 적용
    const clippedCanvas = document.createElement('canvas');
    clippedCanvas.width = finalCanvas.width;
    clippedCanvas.height = finalCanvas.height;
    const clippedCtx = clippedCanvas.getContext('2d');
    clippedCtx.save();
    drawRoundedRect(clippedCtx, 0, 0, clippedCanvas.width, clippedCanvas.height, borderRadius * scale);
    clippedCtx.clip();
    clippedCtx.drawImage(finalCanvas, 0, 0);
    clippedCtx.restore();

    // 최종 결과를 Data URL로 변환하여 새 탭에 표시
    console.log("Generating final image...");
    const finalDataUrl = clippedCanvas.toDataURL();

    // 디버그 정보
    console.log(`Final image dimensions: ${clippedCanvas.width}x${clippedCanvas.height}, scale: ${scale}`);

    // 새 탭에 표시
    const newTab = window.open();
    if (newTab) {
      newTab.document.body.style.margin = '0';
      newTab.document.body.innerHTML = `
        <div style="font-family: Arial, sans-serif; padding: 10px; background: #f0f0f0;">
          <h3>Element Capture Result</h3>
          <p>Element: ${targetElement.tagName.toLowerCase()}</p>
          <p>Size: ${elementWidth}x${elementHeight}px</p>
          <p>Scale: ${scale.toFixed(2)}</p>
        </div>
        <img src="${finalDataUrl}" style="width:100%; height:auto; border: 1px solid #ddd;">
      `;
    } else {
      console.error("새 탭 열기 실패 - 팝업 차단을 확인하세요.");
      // 대안: 모달 등으로 표시
    }
  });

  // 캔버스 클리핑용: 둥근 사각형 경로 그리기 함수
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    radius = Math.min(radius, Math.min(width, height) / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
})();