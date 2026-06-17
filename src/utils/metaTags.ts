function setMetaTag(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

export function setOgImage(url: string) {
  setMetaTag('property', 'og:image', url);
  setMetaTag('property', 'og:image:secure_url', url);
  setMetaTag('name', 'twitter:image', url);
}

