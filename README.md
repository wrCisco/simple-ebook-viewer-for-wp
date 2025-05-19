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

You can add css styles and classes for the viewer container by adding these attributes to the shortcode:
* height
* width
* max-height
* max-width
* border
* style
* class

Height, width, max-height, max-width and border accept any valid CSS value for those property.
Style and class accept any valid value for the respective html attributes.

Some examples:

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" style="height:30em;border:2px inset black"]`

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" max-height="100vh" height="40em"]`

`[simebv_viewer book="MY_EBOOK_SLUG_HERE" class="my-container-class my-container-second-class"]`

### Warning

Ebooks can contain scripted content that might be executed on your webpage. The plugin does its best to forbid script execution from inside the loaded content, but it can't guarantee 100% safety. Don't display ebooks from untrusted sources and/or check your ebooks before uploading and displaying them. If you can, provide a strict Content Security Policy for your site.
