/**
 * ZR INTERIOR DESIGN — CENTRAL CONFIGURATION
 * Verified Business Information, Credentials, and Integration Settings
 */

export const ZR_CONFIG = {
  brand: {
    name: "ZR Interior Design",
    logoText: "ZR",
    subLogoText: "INTERIOR DESIGN",
    principalDesigner: "Mr. Zuber Rafik Banzara",
    role: "Principal Designer",
    city: "Vadodara",
    state: "Gujarat",
    country: "India",
    timelineStart: 1990,
    timelineCurrent: 2026,
    yearsOfHeritage: 36,
    phone: "+91 7878588859",
    phoneRaw: "917878588859",
    whatsappNumber: "917878588859",
    email: "zrinteriordesign@gmail.com",
    studioAddress: "304, Raama Crest, Near HCG Cancer Center, Sunpharma Road, Vadodara - Gujarat. 390012",
    credentials: [
      "London School of Trends Upgradation",
      "Associated with Institute of Indian Interior Designers (IIID)",
      "Design Experience: India · USA · UAE · UK",
      "Complete Turnkey Execution & Site Mastery"
    ]
  },


  assets: {
    portrait: "/assets/images/zuber%20Final%20Photo.png",
    portraitWebp: "/assets/images/zuber-final-photo.webp",
    heroBackground: "/assets/images/FinalImages/project-apartment.jpg",
    timelineImage: "/assets/images/FinalImages/Timeline.png",
    livingRoomSketch: "/assets/images/FinalImages/Sketch%20to%20Reality_%20Modern%20Living%20Room.png",
    penthouse: "/assets/images/FinalImages/project-penthouse.jpg",
    bedroomComparison: "/assets/images/FinalImages/Architectural%20Bedroom%20Plan%20and%20Render%20Comparison.png",
    kitchenComparison: "/assets/images/FinalImages/From%20Plan%20to%20Luxury%20Kitchen.png",
    apartment: "/assets/images/FinalImages/project-apartment.jpg",
    moodboards: "/assets/images/FinalImages/Interior%20Design%20Moodboard%20Collection.png"
  },

  consultation: {
    price: 199,
    currency: "INR",
    currencySymbol: "₹",
    durationMinutes: 45,
    isAdjustableAgainstProject: true,
    policyText: "The ₹199 consultation fee is 100% adjustable against your project if you proceed with ZR Interior Design.",
    modes: [
      { id: "studio", label: "ZR Design Studio (Vadodara)", desc: "In-person consultation at our Vadodara studio (304 Raama Crest, Sunpharma Road) with material samples" },
      { id: "site", label: "Property Site Evaluation (Vadodara)", desc: "On-site review at your villa, apartment, or commercial site in Vadodara" },
      { id: "video", label: "Private Video Call (Google Meet)", desc: "High-definition screen-sharing & architectural floor plan review" }
    ]
  },

  booking: {
    calendlyUrl: "https://calendly.com/zrinteriordesign/45min",
    apiBase: "/api"
  },

  tracking: {
    metaPixelId: "129698837673873",
    debugLogging: true
  }
};
