# Simple Ebook Viewer for WordPress

Simple plugin for WordPress that enables you to upload various ebook formats as normal media files and to display them in your site using a shortcode.

Every ebook uploaded in your site will have an "ebook slug" (by default it will be the ebook name) that you can view and edit in the Edit Media page of the Admin Panel.

The plugin uses the library [foliate-js](https://github.com/johnfactotum/foliate-js) by John Factotum to display ebooks in the browser.

### Supported formats

At the moment, the plugin will let you upload and display the following file types, provided that they are DRM-free:
* epub
* mobi
* azw
* azw3
* fb2
* fbz
* cbz

### Installation

* download the zip file of the latest release of the plugin;
* open the Admin panel of your site;
* on the sidebar click on Plugins -> Add New Plugin;
* click on the "Upload Plugin" button at the top of the page, next to the title;
* click on the "Choose File" button and select the zip file you downloaded;
* click on the "Install Now" button;
* at the end of the installation process, click on the "Activate Plugin" button.

### Usage

Insert the shortcode `[simebv_viewer book="MY_EBOOK_SLUG_HERE"]` in any one of your posts.

#### Styling

You can add css styles and classes for the viewer container by adding these attributes to the shortcode:
* **`height`**
* **`width`**
* **`max-height`**
* **`max-width`**
* **`border`**
* **`style`**
* **`class`**

Height, width, max-height, max-width and border accept any valid CSS value for those property. <br>
Style and class accept any valid value for the respective HTML attributes.

Some examples:

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" style="height:30em;border:2px inset black"]`

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" max-height="100vh" height="40em"]`

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" class="my-container-class my-container-second-class"]`

#### Settings

The users of your site will be able to set their preferences about the appearance of the ebook in the Viewer by opening the Viewer menu (the cog icon on the top right) and by selecting the appropriate entries.

The plugin sets some reasonable defaults for these preferences, but if you're not happy with those defaults, you can change them by adding one or more of the following attributes to the shortcode, with the appropriate values:
* **`layout`**
  - accepted values: "**paginated**" or "**scrolled**" (default: **paginated**)
* **`max-pages`**
  - accepted values: **1**, **2**, **3** or **4** (default: **2**)
* **`default-font-size`**
  - accepted values: "**small**", "**medium**", "**large**", "**x-large**" (default: **medium**)
* **`font-family`**
  - accepted_values: "**auto**", "**serif**", "**sans-serif**", "**monospace**", "**opendyslexic**" (default: **auto**)
* **`page-margins`**
  - accepted values: "**small**", "**medium**", "**large**" (default: **medium**)
* **`show-annotations`**
  - accepted values: "**true**", "**false**" (default: **false**)
* **`show-page-delimiters`**
  - accepted values: "**true**", "**false**" (default: **false**)
* **`zoom`**
  - accepted values: "**fit-page**", "**fit-width**" or a number in the range **10 - 400** (default: **fit-page**)
* **`color-scheme`**
  - accepted values: "**auto**", "**sepia**", "**light**", "**dark**" (default: **auto**)

Layout, max-pages, default-font-size and page-margins are only available for reflowable ebooks, while zoom is only available for fixed layout ones.

Max-pages is the maximum number of pages (in the "paginated" layout) that the user will be able to see in a single view (if there is enough screen space).

Show-annotations and show-page-delimiters let the user see on page the Calibre annotations (if there are Calibre annotations in the ebook) and the page delimiters (if the ebook contains a page list).

Color-scheme: "auto" means that the Viewer will adapt to the preferred color-scheme set by the user in their device or browser (light or dark).

For most ebooks these preferences should be enough, but sometimes there are ebooks with style rules that don't play well with the styles set by the Viewer, so the users have also the option to apply some filters to the Viewer's colors (with the menu entry "Color filter...").

You can set the default values for these filters with the following shortcode's attributes:
* **`activate-color-filter`**
  - accepted values: "**true**", "**false**" (default: **false**)
* **`invert-color-filter`**
  - accepted values: a number in the range **0 - 1** (default: **0**)
* **`rotate-color-filter`**
  - accepted values: a number in the range **0 - 360** (default: **0**)
* **`bg-transparent-filter`**
  - accepted values: "**true**", "**false**" (default: **true**)
* **`bg-color-filter`**
  - accepted values: a valid CSS hex color code (default: **#FFFFFF**)

Set activate-color-filter to "true" is necessary to enable all the other filters, and set bg-transparent-filter to false is necessary to enable bg-color-filter.

Bg-transparent-filter and bg-color-filter are available for reflowable ebooks only.

Invert-color-filter inverts the lightness of the colors. With a value of 0 it has no effect, with a value of 1, the white will become black and the black will become white.

Rotate-color-filter rotates the hues of all the colors in the ebook, like in a [Color Wheel](https://developer.mozilla.org/en-US/docs/Glossary/Color_wheel) (so, no effect on black and white).

There are some other settings that the users won't be able to change by themselves. These are:
* **`always-full-viewport`**
  - accepted values: "**true**", "**false**" (default: **false**. If **true**, **return-to-url** is also required)
* **`return-to-url`**
  - accepted values: a URL with the same hostname than the page that contains the ebook viewer (default: '')
* **`real-fullscreen`**
  - accepted values: "**true**", "**false**" (default: **false**)
* **`allow-js`**
  - accepted values: "**true**", "**false**" (default: **false**)
* **`math-styles`**
  - accepted values: "**fonts**", "**styles**", "**all**" (default: '')
* **`ebook-author`**
  - accepted values: any string, max 260 chars (default: '')
* **`ebook-title`**
  - accepted values: any string, max 260 chars (default: '')
* **`popup-notes`**
  - accepted values: "**true**", "**false**" (default: **true**)

With always-full-viewport set to **true**, the ebook viewer will cover the entire webpage when it is opened, and the "full screen" icon will be replaced by a "close viewer" icon. Always-full-viewport requires that also return-to-url is present, with a valid URL that indicates the destination of the user when they choose to close the viewer. The URL can be a relative one, like "/" or "/books-gallery", or it can be an absolute one, but it needs to have the same hostname of the ebook viewer web page (e.g. if the ebook viewer is opened in the page https://www.example.com/ebook-viewer, the URL in return-to-url needs to start with https://www.example.com).

If real-fullscreen is set to **true**, the ebook viewer will cover the entire screen instead of only the webpage viewport when the user clicks on the "full screen" icon. With real-fullscreen set to true, always-full-viewport is ignored, since the full screen requires an explicit action by the user.

Allow-js: normally, the plugin forbids, as far as possible, script execution from inside the ebooks. If you set allow-js to true, this restriction is relaxed, and scripts within the ebook can be executed.
**Caveat 1**: you need to be absolutely certain that the code inside the ebook is not malicious, since it can harm your entire webpage.
**Caveat 2**: the ebook viewer is not strongly equipped to deal with dynamic content created or removed after the ebook opening, so you might encounter errors or inaccuracies when jumping from one ebook location to another in such a circumstance.

Math-styles: in recent years all the major browser have implemented at least a good deal of the MathML Core specification, so it is now possible to represent natively many mathematical expression without the use of third party libraries. However, not all browsers and systems load automatically appropriate fonts. With math-styles set to **fonts** or **all**, all the contents of MathML expression will use the Latin Modern font.
Another shortcoming in the current support of MathML in the browsers, is that only Gecko based browsers (i.e. Firefox) implement a breaking lines algorithm, so long math expressions within small screens usually don't fit entirely. With math-styles set to **styles** or **all**, the plugin will use some html+css tricks to try to allow either line breaks or horizontal scrolling.

Ebook-author and ebook-title: you can use these optional values to override the ones that the ebook viewer retrieves from the ebook metadata in order to display them to the users.

Popup-notes: show footnotes and endnotes as popup instead of just links. The notes (and their references) need to be correctly marked with the appropriate epub:type attributes to ensure that they are displayed as popups (the ebook viewer will try to recognize them anyway, but it can't guarantee a complete success).

### Development

With `nodejs` and `npm` installed, you can clone the git repository on your device and run in the folder of your local repo:
```
npm install
npm run dev
```
This will activate the vite development server. Provided that your local repository is in the plugins folder of a working Wordpress installation, you'll be able to use the plugin in the Wordpress instance.

To build the frontend assets, in order to use them without the development server, run:
```
npm run build
```

After the build, the files and folders required for the plugin to work will be:
* ./simple-ebook-viewer.php
* ./uninstall.php
* ./vendor/vite-for-wp/vite-for-wp.php
* ./dist
* ./includes
* ./languages

### Privacy

This plugin does not track in any way its users. It uses the WordPress REST API to retrieve the url of the ebooks to display, so it uses the technical cookies setup by WordPress to assure the correctness and the security of the communication.
It also stores in the local storage of the user's browser the last viewed page of the displayed ebook and the preferences about the appearance of the ebooks in the Viewer, as detailed in the previous section, with the only purpose to provide the best experience to the user.
If the user activates the Text-To-Speech functionality and the chosen voice is a remote voice, the browser will send to the remote service the text to be synthesized, the voice and language parameters and, as with any network request, the IP address and the browser identifiers.

### Warning

Ebooks can contain scripted content that might be executed on your webpage. The plugin does its best to forbid script execution from inside the loaded content, but it can't guarantee 100% safety. Don't display ebooks from untrusted sources and/or check your ebooks before uploading and displaying them. If you can, provide a strict Content Security Policy for your site.

### Credits

This plugin embeds a slightly modified version of the foliate-js library
by John Factotum (https://github.com/johnfactotum/foliate-js),
which is distributed under the MIT license.

As secondary dependencies of the foliate-js library, the plugin embeds other three libraries:
* zip.js (https://github.com/gildas-lormeau/zip.js), licensed under the BSD-3-Clause;
* fflate (https://github.com/101arrowz/fflate), MIT licensed.
* PDF.js (https://github.com/mozilla/pdf.js), licensed under the Apache v2.0 license.

PDF.js is present in the repository's source code, but is not included in the distribution of the current version of the plugin.

Other libraries embedded by the plugin are:
* vite-for-wp by Dzikri Aziz (https://github.com/kucrut/vite-for-wp),
licensed under the GPL v2.0 license
* Speech Rule Engine (https://github.com/Speech-Rule-Engine/speech-rule-engine),
licensed under the Apache v2.0 license

Embedded fonts:
* OpenDyslexic (https://opendyslexic.org/) by Abbie Gonzales, licensed under the SIL Open Font License v1.1;
* Manrope (https://github.com/sharanda/manrope) by The Manrope Project Authors, licensed under the SIL Open Font License v1.1;
* Latin Modern (https://www.gust.org.pl/projects/e-foundry) by the Polish TeX Users Group, licensed under the GUST Font License.

OpenDyslexic and Latin Modern fonts have been converted from their original OpenType format to the woff2 format for use on the web, without, at the best of my knowledge, modifying their internal parameters and metadata.
