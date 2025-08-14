# WordPress.org Plugin Assets Directory

This directory contains assets for the WordPress.org plugin directory listing.

## Required Files

### Icons (Required)
- [ ] `icon-128x128.png` - Standard resolution icon (128x128 pixels)
- [ ] `icon-256x256.png` - High-DPI/Retina icon (256x256 pixels)
- [x] `icon.svg` - Vector icon (optional, already created)

### Banners (Required)
- [ ] `banner-772x250.png` - Standard resolution banner
- [ ] `banner-1544x500.png` - High-DPI/Retina banner (exactly 2x)

### Screenshots (Optional)
- [ ] `screenshot-1.png` - Email list with tracking data
- [ ] `screenshot-2.png` - Email detail view
- [ ] `screenshot-3.png` - Compose email screen
- [ ] `screenshot-4.png` - Email settings

## File Specifications

### Icons
- **Formats**: PNG (required), SVG (optional)
- **Sizes**: 128x128px and 256x256px
- **Max file size**: 1MB
- **Design**: Should be clear and recognizable at small sizes

### Banners
- **Format**: PNG or JPG
- **Sizes**: 772x250px and 1544x500px
- **Max file size**: 4MB
- **Design**: Should include plugin name and key features

### Screenshots
- **Format**: PNG or JPG
- **Recommended size**: 1200x900px or similar 4:3 ratio
- **Max file size**: 2MB each
- **Naming**: `screenshot-1.png`, `screenshot-2.png`, etc.

## Design Guidelines

### Color Palette
- Primary: #2271b1 (WordPress blue)
- Secondary: #4CAF50 (Success green)
- Accent: #5B2C8A (Purple gradient)
- Background: White

### Icon Design Elements
- Email envelope symbol
- Tracking indicator (eye icon)
- Clean, minimal design
- Good contrast

### Banner Design Elements
- Plugin name: "Email Tracker"
- Tagline: "Track Opens & Clicks for WordPress Emails"
- Key features highlighted
- Professional appearance

## Creating the Assets

1. **Using Design Software**:
   - Adobe Photoshop/Illustrator
   - Canva (free online)
   - Figma (free)
   - GIMP (free open-source)

2. **Using the Templates**:
   - See `/assets/banner-template.html` for banner design
   - See `/assets/icon-template.html` for icon design
   - Open in browser and capture screenshots

3. **Quick Method**:
   - Use online tools like Canva
   - Create designs with specified dimensions
   - Export as PNG files

## File Naming Convention

Files must be named exactly as specified:
- `icon-128x128.png`
- `icon-256x256.png`
- `icon.svg`
- `banner-772x250.png`
- `banner-1544x500.png`
- `screenshot-1.png`
- `screenshot-2.png`
- etc.

## Deployment

Once all assets are created:
1. Place all files in this `.wordpress-org` directory
2. They will be automatically used when the plugin is submitted to WordPress.org
3. Assets can be updated through SVN after plugin approval

## Current Status

- [x] Directory created
- [x] SVG icon created
- [ ] PNG icons need to be generated
- [ ] Banners need to be created
- [ ] Screenshots need to be captured