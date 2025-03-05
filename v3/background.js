// 개선된 background.js 메시지 처리 및 캡처 함수

// 메시지 리스너 등록 (기존 리스너 유지하고 추가)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('Background received message:', request.action);

  // 직접 요소 정보를 받아 캡처하는 핸들러
  if (request.action === 'captureElementDirect') {
    console.log('Direct capture request received');

    // 입력 유효성 검증
    if (!request.elementInfo) {
      console.error('Error: No element info provided');
      sendResponse({ success: false, error: 'No element info provided' });
      return false;
    }

    // 즉시 응답 후 비동기 작업 진행 (중요!)
    sendResponse({ success: true, message: 'Capture request received' });

    // 현재 활성 탭 확인 (비동기 작업, 응답 후 진행)
    captureActiveTab(sender.tab || null, request.elementInfo);

    return false; // 비동기 처리를 위한 false 반환 (즉시 응답했으므로)
  }

  // 기존 captureElement 핸들러도 유지 (호환성)
  else if (request.action === 'captureElement') {
    console.log('Legacy capture element requested', request.elementSelector);

    // 입력 유효성 검증
    if (!request.elementSelector) {
      sendResponse({ success: false, error: 'No selector provided' });
      return false;
    }

    // 즉시 응답 후 비동기 작업 진행
    sendResponse({ success: true, message: 'Legacy capture request received' });

    // 활성 탭 찾기 (비동기 작업이므로 응답 후 진행)
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      const activeTab = tabs[0];
      if (!activeTab) {
        console.error('Error: No active tab found');
        return;
      }

      processCaptureRequest(activeTab, request.elementSelector);
    });

    return false; // 비동기 작업이지만 즉시 응답했으므로 false 반환
  }

  // 그 외 메시지 처리
  else if (request.action === 'deactivateScreenshotMode') {
    // 포워딩 메시지
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs[0]) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, {action: 'deactivateScreenshotMode'});
        } catch (error) {
          console.error('Error forwarding deactivate message:', error);
        }
      }
    });

    sendResponse({ success: true });
    return false;
  }

  // 알 수 없는 액션에도 응답
  sendResponse({ success: false, error: 'Unknown action: ' + request.action });
  return false;
});

// 콘텐츠 스크립트에 알림 보내기
function notifyContentScript(tabId, message) {
  console.log('Sending notification to content script:', message);
  chrome.tabs.sendMessage(tabId, {
    action: 'showNotification',
    message: message
  }, function(response) {
    if (chrome.runtime.lastError) {
      console.warn('Could not send notification to content script:', chrome.runtime.lastError);
    }
  });
}

// 스크롤 위치 저장
async function saveScrollPosition(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'saveScrollPosition'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Error saving scroll position:', chrome.runtime.lastError);
        // 오류가 발생해도 진행
        resolve();
      } else {
        console.log('Scroll position saved');
        resolve(response);
      }
    });
  });
}

// 스크롤 위치 복원
async function restoreScrollPosition(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'restoreScrollPosition'
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Error restoring scroll position:', chrome.runtime.lastError);
        // 오류가 발생해도 진행
        resolve();
      } else {
        console.log('Scroll position restored');
        resolve(response);
      }
    });
  });
}

// 대체 방법이 포함된 요소 캡처 함수
async function captureElementWithFallback(tabId, elementInfo) {
  console.log('Starting capture with fallback for tab:', tabId);
  console.log('Element info:', elementInfo);

  try {
    // 첫 번째 방법: 전체 요소 캡처 시도
    await captureFullElement(tabId, elementInfo);
  } catch (error) {
    console.warn('Full element capture failed, trying fallback method:', error);
    notifyContentScript(tabId, '고급 캡처 실패, 기본 캡처로 전환 중...');

    // 두 번째 방법: 간단한 화면 캡처 후 크롭 시도
    await captureSimpleScreenshot(tabId, elementInfo);
  }
}

// 전체 요소 캡처 함수 (개선)
async function captureFullElement(tabId, elementInfo) {
  console.log('Starting full element capture');

  const { totalWidth, totalHeight, shape, devicePixelRatio = window.devicePixelRatio || 1 } = elementInfo;

  // 캔버스 생성 및 크기 설정 (고해상도를 위해 devicePixelRatio 적용)
  const canvas = document.createElement('canvas');
  const scaledWidth = totalWidth * devicePixelRatio;
  const scaledHeight = totalHeight * devicePixelRatio;

  // 캔버스 최대 크기 검사 (너무 큰 경우 오류 발생 방지)
  if (scaledWidth > 16384 || scaledHeight > 16384) {
    throw new Error('요소가 너무 큽니다. 최대 캔버스 크기를 초과했습니다.');
  }

  canvas.width = scaledWidth;
  canvas.height = scaledHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('캔버스 컨텍스트를 생성할 수 없습니다.');
  }

  // 고화질을 위한 설정
  ctx.scale(devicePixelRatio, devicePixelRatio);

  try {
    // 캡처할 수 있는 최대 높이 (브라우저 뷰포트 높이 기준)
    const viewportHeight = elementInfo.viewportHeight || window.innerHeight;

    // 세로 방향으로 여러 번 스크롤하며 캡처
    let capturedHeight = 0;
    const partImages = [];

    // 작은 스크롤 단위로 나누어 정확한 캡처
    const scrollStep = Math.min(viewportHeight - 100, 500);

    while (capturedHeight < totalHeight) {
      // 특정 요소 위치로 스크롤
      await scrollToPosition(tabId, elementInfo.scrollTop + capturedHeight);

      // 스크롤 안정화를 위한 대기
      await new Promise(resolve => setTimeout(resolve, 250));

      // 현재 화면 캡처
      try {
        console.log('Capturing visible tab at scroll position:', capturedHeight);
        const imageData = await captureVisibleTab(tabId);

        // 캡처된 이미지 정보 저장
        partImages.push({
          data: imageData,
          yOffset: capturedHeight
        });

        // 다음 스크롤 위치 계산
        capturedHeight += scrollStep;

        // 마지막 부분이 남았다면 정확한 위치로 스크롤
        if (capturedHeight < totalHeight && capturedHeight + scrollStep > totalHeight) {
          capturedHeight = totalHeight - viewportHeight + 100;
          if (capturedHeight < 0) capturedHeight = 0;
        }
      } catch (captureError) {
        console.error('Error during tab capture:', captureError);
        throw new Error('화면 캡처 중 오류가 발생했습니다: ' + captureError.message);
      }
    }

    if (partImages.length === 0) {
      throw new Error('캡처된 이미지가 없습니다.');
    }

    // 모든 부분 이미지를 캔버스에 그리기
    await compositeImages(ctx, partImages, elementInfo);

    // 요소 모양에 따른 클리핑 적용
    applyClipping(ctx, shape, totalWidth, totalHeight);

    // 캡처 완료 알림
    notifyContentScript(tabId, '이미지 저장 중...');

    // 최종 이미지 생성 및 다운로드 (고품질 PNG로 설정)
    const finalImage = canvas.toDataURL('image/png', 1.0);
    const saveResult = await saveOrCopyImage(finalImage, elementInfo.selector || 'element');

    // 성공 알림 (클립보드 복사 상태에 따라 메시지 조정)
    if (saveResult && saveResult.clipboard) {
      notifyContentScript(tabId, '캡처 완료! PNG로 저장 및 클립보드에 복사되었습니다.');
    } else {
      notifyContentScript(tabId, '캡처 완료! PNG로 저장되었습니다.');
    }

  } catch (error) {
    console.error('Error in captureFullElement:', error);
    throw error;
  }
}

// 간단한 스크린샷 캡처 후 크롭하는 폴백 함수
async function captureSimpleScreenshot(tabId, elementInfo) {
  console.log('Starting simple screenshot capture');

  try {
    // 요소 위치로 스크롤
    await scrollToPosition(tabId, elementInfo.scrollTop);

    // 스크롤 안정화 대기
    await new Promise(resolve => setTimeout(resolve, 300));

    // 현재 화면 캡처
    const imageData = await captureVisibleTab(tabId);

    // 이미지 로드
    const img = await loadImage(imageData);

    // 캔버스 생성
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 캔버스 크기 설정 (요소 크기에 맞춤)
    const { boundingRect, devicePixelRatio = 1 } = elementInfo;
    canvas.width = boundingRect.width * devicePixelRatio;
    canvas.height = boundingRect.height * devicePixelRatio;

    // 고화질을 위한 설정
    ctx.scale(devicePixelRatio, devicePixelRatio);

    // 요소 부분만 크롭하여 그리기
    ctx.drawImage(
      img,
      boundingRect.left * devicePixelRatio,
      boundingRect.top * devicePixelRatio,
      boundingRect.width * devicePixelRatio,
      boundingRect.height * devicePixelRatio,
      0,
      0,
      boundingRect.width,
      boundingRect.height
    );

    // 요소 모양에 따른 클리핑 적용
    applyClipping(ctx, elementInfo.shape, boundingRect.width, boundingRect.height);

    // 최종 이미지 생성 및 저장
    const finalImage = canvas.toDataURL('image/png', 1.0);
    const saveResult = await saveOrCopyImage(finalImage, elementInfo.selector || 'element');

    // 성공 알림
    if (saveResult && saveResult.clipboard) {
      notifyContentScript(tabId, '기본 캡처 완료! PNG로 저장 및 클립보드에 복사되었습니다.');
    } else {
      notifyContentScript(tabId, '기본 캡처 완료! PNG로 저장되었습니다.');
    }

  } catch (error) {
    console.error('Error in captureSimpleScreenshot:', error);
    throw error;
  }
}

// 특정 위치로 스크롤
async function scrollToPosition(tabId, scrollTop) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      action: 'scrollToPosition',
      scrollTop: scrollTop
    }, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Error scrolling:', chrome.runtime.lastError);
        // 오류가 발생해도 진행
        resolve();
      } else {
        console.log('Scrolled to position:', scrollTop);
        resolve(response);
      }
    });
  });
}

// 현재 보이는 탭 캡처
async function captureVisibleTab(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, {format: 'png'}, function(dataUrl) {
      if (chrome.runtime.lastError) {
        reject(new Error('화면 캡처 실패: ' + chrome.runtime.lastError.message));
      } else if (!dataUrl) {
        reject(new Error('캡처된 이미지가 없습니다.'));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

// 이미지 저장 및 클립보드 복사
async function saveOrCopyImage(dataUrl, selector) {
  try {
    // 파일명 생성 (요소 타입과 시간 포함)
    const elementType = selector.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth()+1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
    const filename = `screenshot_${elementType}_${timestamp}.png`;

    // DataURL을 Blob으로 변환
    const res = await fetch(dataUrl);
    const blob = await res.blob();

    // Blob URL 생성
    const blobUrl = URL.createObjectURL(blob);

    // 팝업이 열려있으면 상태 알림
    try {
      chrome.runtime.sendMessage({
        action: 'captureStart'
      });
    } catch (e) {
      // 팝업이 닫혀있을 수 있으므로 오류 무시
    }

    // Chrome 다운로드 API 사용
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: blobUrl,
        filename: filename,
        saveAs: true
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          console.error('Download failed:', chrome.runtime.lastError);
          URL.revokeObjectURL(blobUrl);
          reject(new Error('다운로드 실패: ' + chrome.runtime.lastError.message));
          return;
        }

        if (downloadId === undefined) {
          console.error('Download was cancelled or failed');
          URL.revokeObjectURL(blobUrl);
          reject(new Error('다운로드가 취소되었거나 실패했습니다.'));
          return;
        }

        // 다운로드 완료 이벤트 리스너 등록
        chrome.downloads.onChanged.addListener(function downloadListener(delta) {
          if (delta.id === downloadId && delta.state) {
            if (delta.state.current === 'complete') {
              // 다운로드 완료 후 Blob URL 해제
              URL.revokeObjectURL(blobUrl);

              // 다운로드 완료 알림 (팝업용)
              try {
                chrome.runtime.sendMessage({
                  action: 'captureComplete',
                  filename: filename
                });
              } catch (e) {
                // 팝업이 닫혀있을 수 있으므로 오류 무시
              }

              // 리스너 제거
              chrome.downloads.onChanged.removeListener(downloadListener);

              // 클립보드에 복사 시도
              try {
                navigator.clipboard.write([
                  new ClipboardItem({
                    [blob.type]: blob
                  })
                ]).then(() => {
                  console.log('Image copied to clipboard');
                  resolve({ success: true, downloadId, clipboard: true });
                }).catch(clipErr => {
                  console.warn('Failed to copy to clipboard:', clipErr);
                  resolve({ success: true, downloadId, clipboard: false });
                });
              } catch (clipErr) {
                console.warn('Clipboard API not available:', clipErr);
                resolve({ success: true, downloadId, clipboard: false });
              }
            } else if (delta.state.current === 'interrupted') {
              console.error('Download interrupted');
              URL.revokeObjectURL(blobUrl);
              chrome.downloads.onChanged.removeListener(downloadListener);
              reject(new Error('다운로드가 중단되었습니다.'));
            }
          }
        });
      });
    });
  } catch (err) {
    console.error('Failed to save image:', err);
    throw err;
  }
}

// 이미지 로드 헬퍼 함수
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

// 캡처된 이미지들을 하나의 캔버스에 합성
async function compositeImages(ctx, partImages, elementInfo) {
  const { boundingRect, devicePixelRatio = 1 } = elementInfo;

  console.log('Compositing images, count:', partImages.length);

  for (let i = 0; i < partImages.length; i++) {
    const part = partImages[i];
    console.log(`Processing part ${i+1}/${partImages.length}, offset:`, part.yOffset);

    try {
      // 이미지 로드
      const img = await loadImage(part.data);

      // 디버그 정보
      console.log('Image loaded:', {
        imgWidth: img.width,
        imgHeight: img.height,
        boundingRect: boundingRect,
        devicePixelRatio: devicePixelRatio,
        yOffset: part.yOffset
      });

      // 요소의 상대적 위치 계산
      const sourceY = (boundingRect.top + part.yOffset) * devicePixelRatio;
      const height = Math.min(boundingRect.height - part.yOffset, img.height / devicePixelRatio);

      // 캔버스에 이미지 일부분 그리기
      if (height <= 0) {
        console.warn('Skipping part with zero or negative height');
        continue;
      }

      console.log('Drawing image part with params:', {
        sourceX: boundingRect.left * devicePixelRatio,
        sourceY: sourceY,
        sourceWidth: boundingRect.width * devicePixelRatio,
        sourceHeight: height * devicePixelRatio,
        destX: 0,
        destY: part.yOffset,
        destWidth: boundingRect.width,
        destHeight: height
      });

      ctx.drawImage(
        img,
        boundingRect.left * devicePixelRatio,
        sourceY,
        boundingRect.width * devicePixelRatio,
        height * devicePixelRatio,
        0,
        part.yOffset,
        boundingRect.width,
        height
      );
    } catch (error) {
      console.error(`Error processing part ${i+1}:`, error);
      // 개별 부분 오류가 전체를 중단하지 않도록 계속 진행
    }
  }

  console.log('Image composition complete');
}

// 요소 모양에 따른 클리핑 적용
function applyClipping(ctx, shape, width, height) {
  if (!shape || shape.type === 'rectangle') {
    return; // 사각형은 클리핑 필요 없음
  }

  console.log('Applying clipping for shape type:', shape.type);

  ctx.globalCompositeOperation = 'destination-in';

  if (shape.type === 'rounded') {
    // 둥근 모서리 사각형
    const { topLeft, topRight, bottomRight, bottomLeft } = shape.borderRadius ||
      { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

    ctx.beginPath();
    ctx.moveTo(topLeft, 0);
    ctx.lineTo(width - topRight, 0);
    ctx.quadraticCurveTo(width, 0, width, topRight);
    ctx.lineTo(width, height - bottomRight);
    ctx.quadraticCurveTo(width, height, width - bottomRight, height);
    ctx.lineTo(bottomLeft, height);
    ctx.quadraticCurveTo(0, height, 0, height - bottomLeft);
    ctx.lineTo(0, topLeft);
    ctx.quadraticCurveTo(0, 0, topLeft, 0);
    ctx.closePath();
    ctx.fill();
  } else if (shape.type === 'circle') {
    // 원형
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
  } else if (shape.type === 'ellipse') {
    // 타원형
    const centerX = width / 2;
    const centerY = height / 2;
    const radiusX = width / 2;
    const radiusY = height / 2;

    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
  } else if (shape.type === 'polygon' && shape.shapePath) {
    // 다각형
    ctx.beginPath();
    const points = shape.shapePath.points || [];

    if (points.length > 0) {
      try {
        const firstPoint = parsePoint(points[0], width, height);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < points.length; i++) {
          const point = parsePoint(points[i], width, height);
          ctx.lineTo(point.x, point.y);
        }
      } catch (error) {
        console.error('Error parsing polygon points:', error);
        // 폴백으로 사각형 사용
        ctx.rect(0, 0, width, height);
      }
    } else {
      // 포인트가 없으면 기본 사각형
      ctx.rect(0, 0, width, height);
    }

    ctx.closePath();
    ctx.fill();
  } else if (shape.type === 'clip-path' && shape.clipPath) {
    // 간단한 clipPath 처리 - 보통 사각형으로 폴백
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over';
}

// 다각형 점 파싱 헬퍼 함수
function parsePoint(pointStr, width, height) {
  if (!pointStr) return { x: 0, y: 0 };

  // 포인트 형식: "50% 50%" 또는 "100px 200px"
  const parts = pointStr.split(' ');
  if (parts.length < 2) return { x: 0, y: 0 };

  const x = parseValue(parts[0], width);
  const y = parseValue(parts[1], height);

  return { x, y };
}

// 값 파싱 헬퍼 함수 (%, px 등)
function parseValue(value, dimension) {
  if (!value) return 0;

  if (value.endsWith('%')) {
    return dimension * parseFloat(value) / 100;
  } else if (value.endsWith('px')) {
    return parseFloat(value);
  }
  return parseFloat(value) || 0;
}

function captureActiveTab(senderTab, elementInfo) {
  // 탭 정보가 없으면 현재 활성 탭 찾기
  if (!senderTab) {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length === 0) {
        console.error('No active tab found');
        return;
      }
      processCapture(tabs[0], elementInfo);
    });
  } else {
    processCapture(senderTab, elementInfo);
  }
}

async function processCapture(tab, elementInfo) {
  if (!tab || !tab.id) {
    console.error('Invalid tab for capture');
    return;
  }

  try {
    console.log('Starting capture process for tab:', tab.id);

    // 캡처 시작 알림
    safelyNotifyContentScript(tab.id, '캡처 처리 중...');

    // 스크롤 위치 저장
    await safelySendMessage(tab.id, { action: 'saveScrollPosition' });

    try {
      // 캡처 프로세스 실행
      await captureElementWithFallback(tab.id, elementInfo);
    } finally {
      // 성공/실패 여부와 관계없이 스크롤 위치 복원 시도
      await safelySendMessage(tab.id, { action: 'restoreScrollPosition' });
    }
  } catch (error) {
    console.error('Error during capture process:', error);
    safelyNotifyContentScript(tab.id, `캡처 오류: ${error.message || '알 수 없는 오류'}`);
  }
}

function processCaptureRequest(tab, elementSelector) {
  try {
    // 요소 정보 요청
    safelySendMessage(tab.id, {
      action: 'getElementInfo',
      elementSelector: elementSelector
    }).then(response => {
      if (!response || !response.success || !response.elementInfo) {
        console.error('Failed to get element info');
        safelyNotifyContentScript(tab.id, '요소 정보를 가져올 수 없습니다.');
        return;
      }

      // 캡처 프로세스 진행
      processCapture(tab, response.elementInfo);
    }).catch(error => {
      console.error('Error in get element info:', error);
      safelyNotifyContentScript(tab.id, '요소 정보 요청 오류: ' + error.message);
    });
  } catch (error) {
    console.error('Error in legacy capture request:', error);
  }
}

// 안전하게 content script에 알림 보내기
function safelyNotifyContentScript(tabId, message) {
  try {
    chrome.tabs.sendMessage(tabId, {
      action: 'showNotification',
      message: message
    }, function(response) {
      // lastError 체크는 하되, 오류 무시
      if (chrome.runtime.lastError) {
        console.log('Notification message port closed (normal):', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.warn('Error sending notification:', error);
  }
}

// Chrome 메시지 API를 Promise로 래핑하여 안전하게 사용
function safelySendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, function(response) {
        if (chrome.runtime.lastError) {
          console.log('Expected message port error:', chrome.runtime.lastError.message);
          // 메시지 포트 오류지만 작업은 계속 진행 (content script에서 처리됨)
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { success: false, error: 'No response' });
        }
      });
    } catch (error) {
      console.error('Error sending message:', error);
      reject(error);
    }
  });
}

// 특정 위치로 스크롤 (안전하게)
async function scrollToPosition(tabId, scrollTop) {
  try {
    const response = await safelySendMessage(tabId, {
      action: 'scrollToPosition',
      scrollTop: scrollTop
    });

    // 스크롤 후 안정화를 위한 대기
    await new Promise(resolve => setTimeout(resolve, 150));
    return response;
  } catch (error) {
    console.warn('Error scrolling:', error);
    // 오류가 발생해도 계속 진행
    return { success: false, error: error.message };
  }
}