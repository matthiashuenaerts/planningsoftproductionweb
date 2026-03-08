
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global: allow comma (,) as decimal separator in all number inputs
document.addEventListener('keydown', (e) => {
  const target = e.target as HTMLInputElement;
  if (target?.tagName === 'INPUT' && target.type === 'number' && e.key === ',') {
    e.preventDefault();
    // Insert a period at the cursor position
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? target.value.length;
    const currentValue = target.value;
    // Only insert if there's no existing decimal point
    if (!currentValue.includes('.')) {
      const newValue = currentValue.slice(0, start) + '.' + currentValue.slice(end);
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      nativeInputValueSetter.call(target, newValue);
      target.dispatchEvent(new Event('input', { bubbles: true }));
      // Restore cursor position after the inserted dot
      requestAnimationFrame(() => {
        target.setSelectionRange(start + 1, start + 1);
      });
    }
  }
});

createRoot(document.getElementById("root")!).render(<App />);
