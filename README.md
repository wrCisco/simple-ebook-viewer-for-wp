# Simple Ebook Viewer for WordPress

Simple plugin for WordPress that enables you to upload various ebook formats (epub, cbz, mobi among the others) as normal media files and to display them in your site using a shortcode.

Every new uploaded ebook will have an "ebook slug" (by default it will be the ebook name) that you can edit in the Edit Media page from the Admin Panel.

The "viewer" part of the plugin is mainly a wrapper around the [foliate-js](https://github.com/johnfactotum/foliate-js) library by John Factotum.

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

You can add css styles for the viewer container, the topbar and the sidebar by adding these attributes to the shortcode:
* style
* top-style
* sidebar-style

For example: `[simebv_viewer book="MY_EBOOK_SLUG_HERE" style="height:30em;"]`.

### Warning

Ebooks can contain scripted content that might be executed on your webpage: don't display ebooks from untrusted sources and/or check your ebooks before uploading and displaying them.
