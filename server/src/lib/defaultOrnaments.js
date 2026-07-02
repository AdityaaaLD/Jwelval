// Shared base list of ornament names seeded for every new user's Ornament Master.
// Each user's ornament_master rows are independent after seeding (scoped by user_id) —
// editing/adding/removing ornaments for one user never affects another user's list.
export const DEFAULT_ORNAMENTS = [
  'Mangalsutra', 'Bangles', 'Chain', 'Earring', 'Ring', 'Necklace',
  'Pendant', 'Bracelet', 'Anklet', 'Nose Pin', 'Waist Belt',
  'Toe Ring', 'Jhumka', 'Haar', 'Thali', 'Vanki', 'Kangan',
  'Bajuband', 'Coin', 'Bar', 'Biscuit',
]
