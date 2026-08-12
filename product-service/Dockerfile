# 1. Χρησιμοποιούμε μια ελαφριά έκδοση του Node.js (Alpine) ως βάση
FROM node:18-alpine

# 2. Ορίζουμε τον φάκελο εργασίας μέσα στο container
WORKDIR /usr/src/app

# 3. Αντιγράφουμε τα αρχεία package.json (για να ξέρει τι να εγκαταστήσει)
COPY package*.json ./

# 4. Εγκαθιστούμε τις βιβλιοθήκες (μόνο runtime dependencies, όχι τα εργαλεία των tests)
RUN npm install --omit=dev

# 5. Αντιγράφουμε όλο τον υπόλοιπο κώδικά μας (index.js κλπ.)
COPY . .

# 6. Ενημερώνουμε το Docker ότι η εφαρμογή τρέχει στην πόρτα 3001
EXPOSE 3002

# 7. Η εντολή που θα τρέξει όταν ξεκινήσει το container
CMD ["node", "index.js"]