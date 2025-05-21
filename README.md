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
* **`page-margins`**
  - accepted values: "**small**", "**medium**", "**large**" (default: **medium**)
* **`zoom`**
  - accepted values: "**fit-page**", "**fit-width**" or a number in the range **10 - 400** (default: **fit-page**)
* **`color-scheme`**
  - accepted values: "**auto**", "**sepia**" (default: **auto**)

Layout, max-pages, default-font-size and page-margins are only available for reflowable ebooks, while zoom is only available for fixed layout ones.

Max-pages is the maximum number of pages (in the "paginated" layout) that the user will be able to see in a single view (if there is enough screen space).

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

Invert-color-filter inverts the lightness of the colors. With a value of 0 it has no effect, with a value of 1, the white will become black and the black will become white.

Rotate-color-filter rotates the hues of all the colors in the ebook, like in a [Color Wheel](https://developer.mozilla.org/en-US/docs/Glossary/Color_wheel) (so, no effect on black and white).

### Privacy

This plugin does not track in any way its users. It uses the WordPress REST API to retrieve the url of the ebooks to display, so it uses the technical cookies setup by WordPress to assure the correctness and the security of the communication.
It also stores in the local storage of the user's browser the last viewed page of the displayed ebook and the preferences about the appearance of the ebooks in the Viewer, as detailed in the previous section, with the only purpose to provide the best experience to the user.

### Warning

Ebooks can contain scripted content that might be executed on your webpage. The plugin does its best to forbid script execution from inside the loaded content, but it can't guarantee 100% safety. Don't display ebooks from untrusted sources and/or check your ebooks before uploading and displaying them. If you can, provide a strict Content Security Policy for your site.

### Credits

This plugin embeds a slightly modified version of the foliate-js library
by John Factotum (https://github.com/johnfactotum/foliate-js),
which is distributed under the MIT license.

The foliate-js library embeds other three libraries:
* zip.js (https://github.com/gildas-lormeau/zip.js), licensed under the BSD-3-Clause;
* fflate (https://github.com/101arrowz/fflate), MIT licensed;
* PDF.js (https://github.com/mozilla/pdf.js), licensed under the Apache v2.0 license.

This plugin also embeds vite-for-wp by Dzikri Aziz (https://github.com/kucrut/vite-for-wp),
licensed under the GPL v2.0 license.
