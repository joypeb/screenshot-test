document.addEventListener('DOMContentLoaded', function() {
  const screenshotBtn = document.getElementById('screenshot-btn');
  const statusMessage = document.getElementById('status-message');

  // Add hover effects with modern animations
  addButtonEffects(screenshotBtn);

  // Add screenshot button click handler
  screenshotBtn.addEventListener('click', function() {
    // Visual feedback for button click
    animateButtonClick(screenshotBtn);

    // Update status message
    updateStatus('Activating screenshot mode...');

    // Send message to background script to activate screenshot mode
    chrome.runtime.sendMessage({action: 'activateScreenshotMode'}, function(response) {
      if (response && response.success) {
        updateStatus('Screenshot mode activated');

        // Close popup to let user interact with the page
        setTimeout(() => {
          window.close();
        }, 500);
      } else {
        updateStatus('Failed to activate screenshot mode');
      }
    });
  });

  // 캡처 상태 확인을 위한 메시지 리스너 추가
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'captureStart') {
      updateStatus('Capturing screenshot...');
    } else if (request.action === 'captureComplete') {
      updateStatus('Screenshot saved successfully!');
    } else if (request.action === 'captureError') {
      updateStatus(`Error: ${request.error}`);
    }
    return true;
  });

  // Function to update status message with animation
  function updateStatus(message) {
    statusMessage.style.opacity = '0';

    setTimeout(() => {
      statusMessage.textContent = message;
      statusMessage.style.opacity = '1';
    }, 300);
  }

  // Add subtle hover animations to the button
  function addButtonEffects(button) {
    button.addEventListener('mouseover', function() {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.6)';
    });

    button.addEventListener('mouseout', function() {
      button.style.transform = '';
      button.style.boxShadow = '';
    });
  }

  // Animation for button click
  function animateButtonClick(button) {
    button.style.transform = 'scale(0.95)';

    setTimeout(() => {
      button.style.transform = '';
    }, 100);
  }

  // Add ripple effect to buttons
  const buttons = document.querySelectorAll('button');
  buttons.forEach(button => {
    button.addEventListener('click', createRipple);
  });

  function createRipple(event) {
    const button = event.currentTarget;

    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;

    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');

    const ripple = button.getElementsByClassName('ripple')[0];

    if (ripple) {
      ripple.remove();
    }

    button.appendChild(circle);
  }

  // Add CSS for ripple effect
  const style = document.createElement('style');
  style.textContent = `
    .ripple {
      position: absolute;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s linear;
      pointer-events: none;
    }
    
    @keyframes ripple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
    
    button {
      position: relative;
      overflow: hidden;
    }
  `;

  document.head.appendChild(style);
});