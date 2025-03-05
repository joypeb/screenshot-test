/**
 * screenshot.js
 * 스크린샷 캡처 및 처리를 위한 유틸리티 함수들
 */

// 브라우저 환경 감지 및 기능 지원 확인
const browserInfo = {
  // 현재 브라우저가 지원하는 기능 확인
  checkSupport: () => {
    const features = {
      captureAPI: !!chrome.tabs.captureVisibleTab,
      downloadAPI: !!chrome.downloads,
      canvas: !!document.createElement('canvas').getContext,
      blob: typeof Blob !== 'undefined',
      fileReader: typeof FileReader !== 'undefined'
    };

    // 지원하지 않는 기능이 있는지 확인
    const unsupported = Object.entries(features)
      .filter(([_, supported]) => !supported)
      .map(([feature]) => feature);

    return {
      supported: unsupported.length === 0,
      unsupportedFeatures: unsupported
    };
  }
};

// 이미지 캡처 관련 유틸리티
const captureUtils = {
  /**
   * 현재 보이는 탭의 화면을 캡처
   * @param {Object} options - 캡처 옵션
   * @returns {Promise<string>} 캡처된 이미지의 데이터 URL
   */
  captureVisibleTab: (options = { format: 'png', quality: 100 }) => {
    return new Promise((resolve, reject) => {
      try {
        chrome.tabs.captureVisibleTab(null, options, (dataUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(dataUrl);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * 탭의 스크롤 위치를 변경하고 화면을 캡처
   * @param {number} tabId - 캡처할 탭의 ID
   * @param {number} scrollX - 가로 스크롤 위치
   * @param {number} scrollY - 세로 스크롤 위치
   * @param {Object} options - 캡처 옵션
   * @returns {Promise<{dataUrl: string, scrollX: number, scrollY: number}>} 캡처 데이터 및 스크롤 정보
   */
  captureAfterScroll: async (tabId, scrollX, scrollY, options = { format: 'png', quality: 100 }) => {
    // 현재 스크롤 위치 저장
    const originalScrollX = await executeScript(tabId, 'return window.scrollX;');
    const originalScrollY = await executeScript(tabId, 'return window.scrollY;');

    try {
      // 지정된 위치로 스크롤
      await executeScript(tabId, `window.scrollTo(${scrollX}, ${scrollY});`);

      // 스크롤 후 약간의 지연 (렌더링 대기)
      await new Promise(resolve => setTimeout(resolve, 100));

      // 화면 캡처
      const dataUrl = await captureUtils.captureVisibleTab(options);

      return {
        dataUrl,
        scrollX,
        scrollY
      };
    } finally {
      // 원래 스크롤 위치로 복원
      await executeScript(tabId, `window.scrollTo(${originalScrollX}, ${originalScrollY});`);
    }
  },

  /**
   * 전체 페이지 스크린샷을 위한 분할 캡처
   * @param {number} tabId - 캡처할 탭의 ID
   * @param {Object} dimensions - 페이지 및 뷰포트 크기 정보
   * @param {Object} options - 캡처 옵션
   * @returns {Promise<Array<{dataUrl: string, x: number, y: number, width: number, height: number}>>} 캡처된 조각들
   */
  captureFullPage: async (tabId, dimensions, options = { format: 'png', quality: 100 }) => {
    const { scrollWidth, scrollHeight, viewportWidth, viewportHeight } = dimensions;

    // 필요한 캡처 횟수 계산
    const horizontalCaptures = Math.ceil(scrollWidth / viewportWidth);
    const verticalCaptures = Math.ceil(scrollHeight / viewportHeight);

    // 캡처된 이미지 조각들을 저장할 배열
    const captures = [];

    // 페이지를 순회하며 캡처
    for (let y = 0; y < verticalCaptures; y++) {
      for (let x = 0; x < horizontalCaptures; x++) {
        const scrollX = x * viewportWidth;
        const scrollY = y * viewportHeight;

        // 이 조각의 실제 너비와 높이 (페이지 끝부분에서는 작을 수 있음)
        const captureWidth = Math.min(viewportWidth, scrollWidth - scrollX);
        const captureHeight = Math.min(viewportHeight, scrollHeight - scrollY);

        // 캡처 실행
        const { dataUrl } = await captureUtils.captureAfterScroll(tabId, scrollX, scrollY, options);

        captures.push({
          dataUrl,
          x: scrollX,
          y: scrollY,
          width: captureWidth,
          height: captureHeight
        });
      }
    }

    return captures;
  }
};

// 이미지 처리 및 조작 유틸리티
const imageUtils = {
  /**
   * 이미지 데이터 URL을 Canvas에 로드
   * @param {string} dataUrl - 이미지 데이터 URL
   * @returns {Promise<HTMLImageElement>} 로드된 이미지 요소
   */
  loadImage: (dataUrl) => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = dataUrl;
    });
  },

  /**
   * 이미지 자르기 (특정 영역 추출)
   * @param {HTMLImageElement} image - 이미지 요소
   * @param {Object} area - 자를 영역 정보
   * @param {string} format - 출력 형식 ('png' 또는 'jpeg')
   * @param {number} quality - JPEG 압축 품질 (0-100)
   * @returns {string} 잘라낸 이미지의 데이터 URL
   */
  cropImage: (image, area, format = 'png', quality = 100) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = area.width;
    canvas.height = area.height;

    ctx.drawImage(
      image,
      area.x, area.y, area.width, area.height,   // 소스 영역
      0, 0, area.width, area.height              // 대상 영역
    );

    const options = format === 'jpeg' ? { format, quality: quality / 100 } : { format };
    return canvas.toDataURL(`image/${format}`, options.quality);
  },

  /**
   * 여러 이미지 조각을 결합하여 하나의 큰 이미지로 만들기
   * @param {Array<{dataUrl: string, x: number, y: number, width: number, height: number}>} pieces - 이미지 조각들
   * @param {number} totalWidth - 전체 이미지 너비
   * @param {number} totalHeight - 전체 이미지 높이
   * @param {string} format - 출력 형식 ('png' 또는 'jpeg')
   * @param {number} quality - JPEG 압축 품질 (0-100)
   * @returns {Promise<string>} 결합된 이미지의 데이터 URL
   */
  stitchImages: async (pieces, totalWidth, totalHeight, format = 'png', quality = 100) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = totalWidth;
    canvas.height = totalHeight;

    // 모든 이미지 조각을 캔버스에 그리기
    for (const piece of pieces) {
      const image = await imageUtils.loadImage(piece.dataUrl);
      ctx.drawImage(image, piece.x, piece.y);
    }

    const options = format === 'jpeg' ? { format, quality: quality / 100 } : { format };
    return canvas.toDataURL(`image/${format}`, options.quality);
  }
};

// 캔버스 작업 및 특수 효과 유틸리티
const canvasUtils = {
  /**
   * 캔버스에 둥근 사각형 경로 생성
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} x - X 좌표
   * @param {number} y - Y 좌표
   * @param {number} width - 너비
   * @param {number} height - 높이
   * @param {number|Object} radius - 모서리 반경 (숫자 또는 각 모서리별 반경 객체)
   */
  roundedRect: (ctx, x, y, width, height, radius) => {
    if (typeof radius === 'number') {
      radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
      radius = { tl: 0, tr: 0, br: 0, bl: 0, ...radius };
    }

    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  },

  /**
   * 타원형 경로 생성
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {number} x - 중심 X 좌표
   * @param {number} y - 중심 Y 좌표
   * @param {number} radiusX - X축 반경
   * @param {number} radiusY - Y축 반경
   * @param {number} rotation - 회전 각도 (라디안)
   * @param {number} startAngle - 시작 각도 (라디안)
   * @param {number} endAngle - 종료 각도 (라디안)
   */
  ellipse: (ctx, x, y, radiusX, radiusY, rotation = 0, startAngle = 0, endAngle = Math.PI * 2) => {
    // 기본 ellipse 메서드가 지원되면 사용
    if (ctx.ellipse) {
      ctx.beginPath();
      ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
      return;
    }

    // 지원되지 않는 경우 근사치로 타원 그리기
    ctx.beginPath();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.scale(radiusX, radiusY);
    ctx.arc(0, 0, 1, startAngle, endAngle);
    ctx.restore();
  },

  /**
   * 캔버스에 그림자 효과 적용
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {Object} options - 그림자 옵션
   */
  applyShadow: (ctx, options = {}) => {
    const defaults = {
      color: 'rgba(0, 0, 0, 0.5)',
      blur: 5,
      offsetX: 3,
      offsetY: 3
    };

    const settings = { ...defaults, ...options };

    ctx.shadowColor = settings.color;
    ctx.shadowBlur = settings.blur;
    ctx.shadowOffsetX = settings.offsetX;
    ctx.shadowOffsetY = settings.offsetY;
  },

  /**
   * 이미지에 워터마크 추가
   * @param {CanvasRenderingContext2D} ctx - 캔버스 컨텍스트
   * @param {string} text - 워터마크 텍스트
   * @param {Object} options - 워터마크 옵션
   */
  addWatermark: (ctx, text, options = {}) => {
    const defaults = {
      font: '14px Arial',
      color: 'rgba(150, 150, 150, 0.5)',
      position: 'bottomRight', // 'topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'center'
      padding: 10
    };

    const settings = { ...defaults, ...options };
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;

    ctx.save();
    ctx.font = settings.font;
    ctx.fillStyle = settings.color;

    const textWidth = ctx.measureText(text).width;
    let x, y;

    // 위치 계산
    switch (settings.position) {
      case 'topLeft':
        x = settings.padding;
        y = settings.padding + 14; // 폰트 크기 고려
        break;
      case 'topRight':
        x = width - textWidth - settings.padding;
        y = settings.padding + 14;
        break;
      case 'bottomLeft':
        x = settings.padding;
        y = height - settings.padding;
        break;
      case 'bottomRight':
        x = width - textWidth - settings.padding;
        y = height - settings.padding;
        break;
      case 'center':
        x = (width - textWidth) / 2;
        y = height / 2;
        break;
    }

    ctx.fillText(text, x, y);
    ctx.restore();
  }
};

// 파일 저장 및 형식 변환 유틸리티
const fileUtils = {
  /**
   * 데이터 URL을 Blob으로 변환
   * @param {string} dataUrl - 데이터 URL
   * @returns {Blob} 변환된 Blob 객체
   */
  dataUrlToBlob: (dataUrl) => {
    const parts = dataUrl.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new Blob([uInt8Array], { type: contentType });
  },

  /**
   * Blob을 데이터 URL로 변환
   * @param {Blob} blob - Blob 객체
   * @returns {Promise<string>} 변환된 데이터 URL
   */
  blobToDataUrl: (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  /**
   * 이미지 다운로드 (Chrome 확장 프로그램 API 사용)
   * @param {string} dataUrl - 이미지 데이터 URL
   * @param {string} filename - 저장할 파일명
   * @param {boolean} saveAs - 저장 대화상자 표시 여부
   * @returns {Promise<number>} 다운로드 ID
   */
  downloadImage: (dataUrl, filename, saveAs = false) => {
    return new Promise((resolve, reject) => {
      chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: saveAs
      }, (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      });
    });
  },

  /**
   * 파일 형식 변환 (예: PNG -> JPEG)
   * @param {string} dataUrl - 원본 이미지 데이터 URL
   * @param {string} targetFormat - 대상 형식 ('png' 또는 'jpeg')
   * @param {number} quality - JPEG 압축 품질 (0-100)
   * @returns {Promise<string>} 변환된 이미지 데이터 URL
   */
  convertFormat: async (dataUrl, targetFormat, quality = 100) => {
    // 이미지 로드
    const image = await imageUtils.loadImage(dataUrl);

    // 캔버스 생성
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;

    // 이미지 그리기
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, 0, 0);

    // 새 형식으로 변환
    const options = targetFormat === 'jpeg' ? { quality: quality / 100 } : {};
    return canvas.toDataURL(`image/${targetFormat}`, options.quality);
  }
};

// 특수 스크린샷 패턴 처리 유틸리티
const screenshotPatterns = {
  /**
   * 스크롤이 필요한 큰 요소의 스크린샷
   * @param {number} tabId - 탭 ID
   * @param {Object} elementInfo - 요소 정보
   * @param {string} format - 출력 형식
   * @param {number} quality - 이미지 품질
   * @returns {Promise<string>} 스크린샷 데이터 URL
   */
  captureScrollableElement: async (tabId, elementInfo, format = 'png', quality = 100) => {
    // 요소의 전체 치수 확인
    const { left, top, width, height, scrollWidth, scrollHeight } = elementInfo;

    // 뷰포트 크기 가져오기
    const viewportWidth = await executeScript(tabId, 'return window.innerWidth;');
    const viewportHeight = await executeScript(tabId, 'return window.innerHeight;');

    // 요소가 뷰포트 내에 완전히 들어오는지 확인
    const isElementFullyVisible =
      width <= viewportWidth &&
      height <= viewportHeight &&
      left >= 0 &&
      top >= 0 &&
      left + width <= viewportWidth &&
      top + height <= viewportHeight;

    // 요소가 완전히 보이면 단일 캡처
    if (isElementFullyVisible) {
      const screenshotUrl = await captureUtils.captureVisibleTab({ format, quality });
      const image = await imageUtils.loadImage(screenshotUrl);

      return imageUtils.cropImage(
        image,
        { x: left, y: top, width, height },
        format,
        quality
      );
    }

    // 요소가 완전히 보이지 않으면 조각으로 캡처
    const pieces = await captureUtils.captureFullPage(
      tabId,
      {
        scrollWidth,
        scrollHeight,
        viewportWidth,
        viewportHeight
      },
      { format, quality }
    );

    // 요소 영역에 해당하는 조각만 선택
    const relevantPieces = pieces.filter(piece => {
      return (
        piece.x < left + width &&
        piece.x + piece.width > left &&
        piece.y < top + height &&
        piece.y + piece.height > top
      );
    });

    // 조각들을 결합하여 요소 영역만 추출
    return imageUtils.stitchImages(
      relevantPieces,
      width,
      height,
      format,
      quality
    );
  },

  /**
   * 특정 모양의 요소 스크린샷 (둥근 모서리, 원형 등)
   * @param {number} tabId - 탭 ID
   * @param {Object} elementInfo - 요소 정보 (모양 정보 포함)
   * @param {string} format - 출력 형식
   * @param {number} quality - 이미지 품질
   * @returns {Promise<string>} 스크린샷 데이터 URL
   */
  captureShapedElement: async (tabId, elementInfo, format = 'png', quality = 100) => {
    // 먼저 요소 전체 캡처
    const elementDataUrl = await screenshotPatterns.captureScrollableElement(
      tabId, elementInfo, format, quality
    );

    // 이미지 로드
    const image = await imageUtils.loadImage(elementDataUrl);

    // 캔버스 생성
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = elementInfo.width;
    canvas.height = elementInfo.height;

    // 요소 모양에 따른 처리
    switch (elementInfo.shape) {
      case 'rounded':
        // 둥근 모서리 처리
        let radius = 0;
        if (elementInfo.borderRadius) {
          // 'Xpx' 형식에서 숫자만 추출
          const match = elementInfo.borderRadius.match(/^(\d+)px$/);
          radius = match ? parseInt(match[1]) : 0;
        }

        canvasUtils.roundedRect(ctx, 0, 0, elementInfo.width, elementInfo.height, radius);
        ctx.clip();
        break;

      case 'circle':
        // 원형 처리
        const centerX = elementInfo.width / 2;
        const centerY = elementInfo.height / 2;
        const radius2 = Math.min(centerX, centerY);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius2, 0, Math.PI * 2);
        ctx.clip();
        break;

      case 'ellipse':
        // 타원형 처리
        const radiusX = elementInfo.width / 2;
        const radiusY = elementInfo.height / 2;

        canvasUtils.ellipse(ctx, radiusX, radiusY, radiusX, radiusY);
        ctx.clip();
        break;

      // 기본값은 직사각형 (클리핑 불필요)
      default:
        break;
    }

    // 이미지 그리기
    ctx.drawImage(image, 0, 0, elementInfo.width, elementInfo.height);

    // 결과 반환
    const options = format === 'jpeg' ? { quality: quality / 100 } : {};
    return canvas.toDataURL(`image/${format}`, options.quality);
  }
};

// 스크립트 실행 도우미 함수
function executeScript(tabId, code) {
  return new Promise((resolve, reject) => {
    chrome.tabs.executeScript(tabId, { code }, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[0]);
      }
    });
  });
}

// 내보내기
export {
  browserInfo,
  captureUtils,
  imageUtils,
  canvasUtils,
  fileUtils,
  screenshotPatterns,
  executeScript
};