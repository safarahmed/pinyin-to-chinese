const DEFAULTS = {
  variant: 'traditional',
  numCandidates: 4,
  autoCopy: false
};

const variantRadios = document.querySelectorAll('input[name="variant"]');
const numSelect = document.getElementById('numCandidates');
const autoCopyCheckbox = document.getElementById('autoCopy');
const savedMsg = document.getElementById('savedMsg');

// Load settings
chrome.storage.sync.get(DEFAULTS, (data) => {
  document.querySelector(`input[name="variant"][value="${data.variant}"]`).checked = true;
  numSelect.value = String(data.numCandidates);
  autoCopyCheckbox.checked = data.autoCopy;
});

// Save on change
function save() {
  const settings = {
    variant: document.querySelector('input[name="variant"]:checked').value,
    numCandidates: parseInt(numSelect.value, 10),
    autoCopy: autoCopyCheckbox.checked
  };
  chrome.storage.sync.set(settings, () => {
    savedMsg.classList.add('show');
    setTimeout(() => savedMsg.classList.remove('show'), 1200);
  });
}

variantRadios.forEach((r) => r.addEventListener('change', save));
numSelect.addEventListener('change', save);
autoCopyCheckbox.addEventListener('change', save);
