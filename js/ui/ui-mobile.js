// ================================================================
// MOBILE NAVIGATION
// ================================================================
function isMobile() { return window.innerWidth <= 768; }

export function toggleMobileMenu() {
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  if (left.classList.contains('mobile-visible') || right.classList.contains('mobile-visible')) {
    left.classList.remove('mobile-visible');
    right.classList.remove('mobile-visible');
    setActiveTab('canvas');
  } else {
    showMobilePanel('left');
  }
}

export function showMobilePanel(panel) {
  if (!isMobile()) return;
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  left.classList.remove('mobile-visible');
  right.classList.remove('mobile-visible');
  if (panel === 'left') left.classList.add('mobile-visible');
  else if (panel === 'right') right.classList.add('mobile-visible');
  setActiveTab(panel);
  setTimeout(window._resize, 50);
}

function setActiveTab(panel) {
  document.querySelectorAll('.mobile-tab-bar button').forEach(b => b.classList.remove('active'));
  const tab = document.getElementById('mob-tab-' + panel);
  if (tab) tab.classList.add('active');
}

// Close dropdowns on outside click
document.addEventListener('click',e=>{if(!e.target.closest('.add-res-container'))document.querySelectorAll('.res-dropdown').forEach(d=>d.classList.remove('show'));});

// Close mobile panels on window resize to desktop
window.addEventListener('resize', function() {
  if (!isMobile()) {
    document.getElementById('sidebar-left').classList.remove('mobile-visible');
    document.getElementById('sidebar-right').classList.remove('mobile-visible');
  }
});
