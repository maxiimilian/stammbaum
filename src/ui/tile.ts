import { photoUrl } from '../data';
import type { Person } from '../parser/types';
import { avatarHue, familyName, initials, lifespan, shortName } from './format';

/** The photo bubble on its own — shared by every HTML view. */
export function bubble(person: Person, size: number): HTMLElement {
  const wrapper = document.createElement('span');
  wrapper.className = 'bubble-html';
  wrapper.style.setProperty('--bubble-size', `${size}px`);

  const url = photoUrl(person);
  if (url) {
    const image = document.createElement('img');
    image.src = url;
    image.alt = person.name;
    image.loading = 'lazy';
    wrapper.append(image);
  } else {
    const fallback = document.createElement('span');
    fallback.className = 'bubble-initials-html';
    fallback.style.background = `hsl(${avatarHue(person.id)} 55% 78%)`;
    fallback.textContent = initials(person);
    wrapper.append(fallback);
  }

  const plumbob = document.createElement('span');
  plumbob.className = 'plumbob-html';
  wrapper.append(plumbob);
  return wrapper;
}

/** A clickable person: bubble, name, years. */
export function tile(person: Person, size = 84): HTMLAnchorElement {
  const link = document.createElement('a');
  link.className = `tile${person.died ? ' is-deceased' : ''}`;
  link.href = `#/p/${encodeURIComponent(person.id)}`;
  link.append(bubble(person, size));

  const name = document.createElement('span');
  name.className = 'tile-name';
  name.textContent = shortName(person);
  link.append(name);

  const surname = familyName(person);
  if (surname) {
    const element = document.createElement('span');
    element.className = 'tile-surname';
    element.textContent = surname;
    link.append(element);
  }

  const years = lifespan(person);
  if (years) {
    const element = document.createElement('span');
    element.className = 'tile-years';
    element.textContent = years;
    link.append(element);
  }
  return link;
}
