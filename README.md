# Simple Ebook Viewer for WordPress

Simple plugin for WordPress that enables you to upload various ebook formats (epub, cbz, mobi among the others) as normal media files and to display them in your site using a shortcode.

Every new uploaded ebook will have an "ebook slug" (by default it will be the ebook name) that you can edit in the Edit Media page from the Admin Panel.

### Usage

Insert the shortcode `[simebv_viewer book="MY_EBOOK_SLUG_HERE"]` in one (or many) of your posts.

You can add css styles for the viewer container, the topbar and the sidebar by adding these attributes to the shortcode:
* style
* top-style
* sidebar-style

For example: `[simebv_viewer book="MY_EBOOK_SLUG_HERE" style="height:30em;"]`.

### Warning

Ebooks can contain scripted content that might be executed on your webpage: don't display ebooks from untrusted sources and/or check your ebooks before uploading and displaying them.
