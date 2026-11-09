/**
 * Promise-based, in-app confirmation dialogs.
 *
 * `window.confirm()` is a browser-owned popup: it blocks the UI, cannot be
 * styled, and its placement varies between browsers/embedded previews. All
 * destructive / discard decisions now go through one centered modal instead.
 */
export const CONFIRM_EVENT = "astra:confirm";

export interface ConfirmOptions {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export interface ConfirmDetail extends ConfirmOptions {
  message: string;
  handled: boolean;
  resolve: (confirmed: boolean) => void;
}

export function confirmAction(message: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  return new Promise<boolean>(resolve => {
    const detail: ConfirmDetail = { ...options, message, handled: false, resolve };
    window.dispatchEvent(new CustomEvent<ConfirmDetail>(CONFIRM_EVENT, { detail }));
    // Safety net when the host is not mounted (e.g. an early boot error).
    if (!detail.handled) resolve(window.confirm(message));
  });
}
