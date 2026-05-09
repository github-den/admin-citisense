export const POST_TYPES = {
  complaint:  { label: 'Complaint',  color: '#F97316', bg: '#FFF7ED' },
  suggestion: { label: 'Suggestion', color: '#D97706', bg: '#FFFBEB' },
  compliment: { label: 'Compliment', color: '#16A34A', bg: '#F0FDF4' },
};

export const POST_STATUSES = {
  UNDER_REVIEW: 'Under Review',
  IN_PROGRESS:  'In Progress',
  ON_HOLD:      'On hold',
  RESOLVED:     'Resolved',
  DISMISSED:    'Dismissed',
  INVALID:      'Invalid',
  CLOSED:       'Closed',
};

export const STATUS_COLORS = {
  'Under Review': { color: '#94A3B8', bg: '#F1F5F9' },
  'In Progress':  { color: '#D97706', bg: '#FFFBEB' },
  'On hold':      { color: '#94A3B8', bg: '#F1F5F9' },
  'Resolved':     { color: '#16A34A', bg: '#F0FDF4' },
  'Dismissed':    { color: '#DC2626', bg: '#FEE2E2' },
  'Invalid':      { color: '#DC2626', bg: '#FEE2E2' },
  'Closed':       { color: '#475569', bg: '#E2E8F0' },
};

export const URDANETA_BARANGAYS = [
  'Old City Hall (Poblacion)',
  'New City Hall (Anonas)',
  'Anonas',
  'Bactad East',
  'Bayaoas',
  'Bolaoen',
  'Cabaruan',
  'Cabuloan',
  'Camanang',
  'Camantiles',
  'Casantaan',
  'Catablan',
  'Cayambanan',
  'Consolacion',
  'Dilan-Paurido',
  'Labit Proper',
  'Labit West',
  'Mabanogbog',
  'Macalong',
  'Nancalobasaan',
  'Nancamaliran East',
  'Nancamaliran West',
  'Nancayasan',
  'Oltama',
  'Palina East',
  'Palina West',
  'Pedro T. Orata',
  'Pinmaludpod',
  'Poblacion',
  'San Jose',
  'San Vicente',
  'Santa Lucia',
  'Santo Domingo',
  'Sugcong',
  'Tipuso',
  'Tulong',
];

export const SERVICE_CATEGORY_OFFICES = {
  Health: 'City Health Office',
  Infrastructure: 'City Engineers Office',
  'Social Welfare': 'City Social Welfare and Development Office',
  Environment: 'City Environment and Natural Resources Office',
  'Peace & Order': 'Public Order and Safety Office - Security Division',
  'Public Facilities': 'City Engineers Office',
  'Economic Services': 'Business Permits and Licensing Office, City Planning and Development Office',
  Agriculture: 'City Agriculture Office',
  Education: 'City Schools Division Office',
  Housing: 'City Housing Office, City Planning and Development Office',
  Tourism: 'City Tourism Office',
  Transportation: 'City Transport and Traffic Management Office',
};

export const SERVICE_CATEGORIES = Object.keys(SERVICE_CATEGORY_OFFICES).sort((a, b) => a.localeCompare(b));

export const SERVICE_CATEGORY_OPTIONS = SERVICE_CATEGORIES.map((category) => ({
  value: category,
  label: category,
  office: SERVICE_CATEGORY_OFFICES[category],
}));

export const PAGES = {
  FEED:          'feed',
  DISCUSS:       'discuss',
  FEEDBOX:       'feedbox',
  INSIDEBOX:     'insidebox',
  TRACK:         'track',
  INITIATIVES:   'initiatives',
  CITIMOOD:      'citimood',
  PROFILE:       'profile',
  NOTIFICATIONS: 'notifications',
  FOR_LATER:     'forlater',
  DRAFTS:        'drafts',
  WRITE_FB:      'writefb',
  HELP:          'help',
  SEARCH:        'search',
  SETUP:         'setup',
};

export const KANBAN_COLS = [
  { id: 'underreview', label: 'Under Review', color: '#94A3B8' },
  { id: 'verified',    label: 'Verified',     color: '#16A34A' },
  { id: 'resolved',    label: 'Resolved',     color: '#2563EB' },
  { id: 'dismissed',   label: 'Dismissed',    color: '#DC2626' },
  { id: 'closed',      label: 'Closed',       color: '#475569' },
];
