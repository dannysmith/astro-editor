---
title: "Image Preview Testing Article"
slug: "image-preview-test"
description: "Test article for validating image preview functionality with various image link types"
pubDate: 2025-01-22
tags: ["testing", "images", "preview"]
author: danny-smith
draft: false
cover: "/src/assets/articles/styleguide-image.jpg"
---

# Image Preview Testing Article

This article is specifically designed to test the image preview functionality with various types of image references.

## Lorem Ipsum Introduction

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## Absolute Path Image (from project root)

Here's an image using an absolute path from the project root:

![Styleguide Image](/src/assets/articles/styleguide-image.jpg)

Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

## Relative Path Image (same directory)

Here's an image using a relative path in the same directory as this markdown file:

![Image Test](./imagetest.png)

Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.

## Remote Image (HTTP URL)

Here's an image loaded from a remote URL:

![Danny's Avatar](https://danny.is/avatar.jpg)

Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.

## HTML Image Tag

You can also use standard HTML img tags:

<img src="/src/assets/articles/styleguide-image.jpg" alt="Styleguide via HTML tag" width="400" />

Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.

## Plain Image URLs

Sometimes images are just referenced as plain URLs in text:

Check out this image: https://danny.is/avatar.jpg or this one: /src/assets/articles/styleguide-image.jpg

You can also reference the local one: ./imagetest.png

## Mixed Content Test

Here's a paragraph with **bold text**, *italic text*, and an image ![inline test](https://danny.is/avatar.jpg) mixed in with other content. This tests how the preview handles inline images within flowing text.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. ![Another inline](./imagetest.png) Integer nec odio. Praesent libero. Sed cursus ante dapibus diam.

## Conclusion

Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur.

At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga.
