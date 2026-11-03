import '../styles/main.css';
import { initCopyrightYear, initHeaderScroll } from './modules/header';
import { initContactForm } from './modules/contact-form';
import { initMobileNav } from './modules/mobile-nav';

/**
 * Entry point. Every feature is optional: a page without a given element
 * simply skips that initialiser, so one bundle serves all seven pages.
 */

const header = document.querySelector<HTMLElement>('[data-site-header]');
if (header) initHeaderScroll(header);

const menu = document.querySelector<HTMLDetailsElement>('[data-mobile-nav]');
if (menu) initMobileNav(menu);

const form = document.querySelector<HTMLFormElement>('[data-contact-form]');
if (form) initContactForm(form);

initCopyrightYear();
