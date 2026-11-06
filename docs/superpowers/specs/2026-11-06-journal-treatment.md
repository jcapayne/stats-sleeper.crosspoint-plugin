# Reading journal visual treatment

The user selected both journal treatments and a slightly tilted goal seal, after being offered the option to proceed directly with both. Keep the existing metrics, API, authentication, image bounds, and native reader formats. No firmware changes or new book metadata are needed.

The transparent mode gets a compact white bookplate over the cover, with serif headings, prominent numeric columns, fine rules, rounded corners, and a circular annual-goal seal tilted about ten degrees across the upper border. Goal completion changes the seal to an achievement treatment without implying that the current book is finished.

Custom gets a full-page journal composition: paper margins, a small original book motif, an editorial heading, framed user artwork or an original line illustration, then the matching bookplate and tilted seal. Both top/bottom panel placement and hidden/missing metrics remain supported. Small/landscape screens use a compact composition that stays within the screen.

Use original code-drawn geometry and licensed Lora fonts bundled with the server, parsed/rasterized in pure JavaScript. Keep its OFL license alongside the fonts. No native graphics packages or runtime font downloads. The reference inspires the printed-book feeling, not its exact layout, text, artwork, or READ/date badge.

Implementation sequence:

1. Add behavioral layout tests for portrait and short landscape bounds, tilted goal placement, metric omission, and framed Custom artwork. Observe failures against the old renderer.
2. Add font/raster primitives and shared journal layout, preserving safe PNG validation and native 2-bit BMP encoding.
3. Render and inspect progress/completed, overlay/Custom, and artwork examples at reader resolution; revise spacing where needed.
4. Run renderer, API, full server and plugin integration checks; independent final review; commit as jcapayne. Leave service deployment and branch integration decisions on hold for local testing.
