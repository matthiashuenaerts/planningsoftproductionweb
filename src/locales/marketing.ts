const marketing: Record<string, Record<string, string>> = {
  nl: {
    // Nav
    nav_features: "Functionaliteiten",
    nav_solutions: "Oplossingen",
    nav_integration: "Integratie",
    nav_contact: "Contact",
    nav_demo: "Demo Aanvragen",
    nav_login: "Inloggen",
    nav_developer: "Developer Portal",

    // Hero
    hero_badge: "Productieplanning eenvoudig gemaakt",
    hero_title_1: "Uw productie",
    hero_title_2: "naar perfectie geleid",
    hero_subtitle: "Het alles-in-één productieplanningsplatform voor meubelfabrikanten. Beheer werkstations, bestellingen, logistiek en teams — alles vanuit één plek.",
    hero_cta: "Demo Aanvragen",
    hero_portal: "Thonon Portaal",

    // Pain points
    pain_title: "Herken je dit?",
    pain_subtitle: "Veel productiebedrijven worstelen dagelijks met deze uitdagingen.",
    pain_1: "Planning voelt als gokken",
    pain_2: "Spoedorders verstoren alles",
    pain_3: "Onderdelen zoek, vrachtwagens halfvol",
    pain_4: "Nacalculatie gebeurt… nooit of te laat",
    pain_5: "Bottlenecks zien we pas als het te laat is",
    pain_6: "Kennis zit in hoofden, niet in systemen",
    pain_7: "We werken in vijf tools die niets delen",

    // Core values
    core_title: "Kernwaarden van de software",
    core_subtitle: "Gebouwd op moderne technologie, ontworpen voor de productieindustrie.",
    core_web: "Webapplicatie",
    core_web_desc: "Toegankelijk vanuit elke browser, op elk apparaat. Geen installatie nodig.",
    core_digital: "Digitalisering",
    core_digital_desc: "Volledige digitalisering van uw productieomgeving en administratie.",
    core_flex: "Flexibiliteit",
    core_flex_desc: "Geschikt voor zowel eenvoudige als complexe productiesystemen.",
    core_scale: "Schaalbaarheid",
    core_scale_desc: "Groeit mee met uw bedrijf. Van klein atelier tot grote fabriek.",
    core_integrate: "Integratie",
    core_integrate_desc: "Naadloze koppeling met CrownBase Pro en andere systemen.",
    core_lang: "Meertalig",
    core_lang_desc: "Taalgebonden accounts in Nederlands, Frans en Engels.",
    core_security: "Multi-Tenant",
    core_security_desc: "Elke onderneming krijgt een volledig geïsoleerde omgeving.",
    core_care: "Ontzorging",
    core_care_desc: "Minder handmatig werk voor personeel en administratie.",

    // Features page
    features_title: "Alle functionaliteiten",
    features_subtitle: "Een compleet pakket tools specifiek ontworpen voor meubel- en interieurproducenten.",

    feat_project_title: "Projectbeheer",
    feat_project_desc: "Centraal overzicht van alle projecten met klantinfo, deadlines, bestellijsten, accessoires en bestanden. Volledige traceerbaarheid van intake tot oplevering.",
    feat_project_bullets: "Bestelmateriaal & accessoires beheer|Kostenoverzicht per project|Koppeling met bestellingen|Mail met projectstatus",

    feat_planning_title: "Productieplanning & Gantt",
    feat_planning_desc: "Geavanceerd planningssysteem met Gantt charts, drag-and-drop scheduling en automatische capaciteitsoptimalisatie. Persoonsgebonden planning met prioriteit op installatiedatum.",
    feat_planning_bullets: "Slim auto-toewijzen van taken|Haalbaarheidsanalyse per project|Realtime aanpassingen|Overzicht werkbelasting per medewerker",

    feat_rush_title: "Spoedbestellingen",
    feat_rush_desc: "Dedicated rush order systeem met directe notificaties, toewijzing van personen en taken, deadline tracking en ingebouwde chat.",
    feat_rush_bullets: "Critical priority markering|Tijdsregistratie per taak|Ingebouwde chat per spoedbestelling|Meldingen op dashboards",

    feat_install_title: "Plaatsingsbeheer",
    feat_install_desc: "Volledig beheer van installatieploegen met planning per team, koppeling aan vrachtwagens en wekelijks laadschema.",
    feat_install_bullets: "Opsplitsing per plaatsingsploeg|Laden vrachtwagen één werkdag voor plaatsing|Handige dashboards|Wekelijks laadschema",

    feat_logistics_title: "Logistiek IN & UIT",
    feat_logistics_desc: "Beheer inkomende leveringen met barcode scanning, ontvangstbevestiging en backorder opvolging. Uitgaande logistiek met externe verwerkingstijdlijn.",
    feat_logistics_bullets: "Ontvangstbevestiging met afbeelding|Synchronisatie met CrownBase Pro|Opvolging backorders|Externe verwerkingstijdlijn",

    feat_time_title: "Tijdsregistratie",
    feat_time_desc: "Persoonlijke tijdsregistraties gekoppeld aan projecten en taken. Exporteerbare rapporten en interactief taakeiland met picture-in-picture optie.",
    feat_time_bullets: "Gekoppeld uurtarief voor nacalculatie|Exporteren rapporten|Op- en aftelklok|Filter per werknemer, project of taak",

    feat_dashboard_title: "Dashboards & Monitoring",
    feat_dashboard_desc: "Real-time productie dashboards met werkstation overzicht, actieve medewerkers, spoedbestellingen en productieflow visualisatie.",
    feat_dashboard_bullets: "Werkstation controlepaneel|Production flow overzicht|Actieve machines & workers|Taak timeline per werkpost",

    feat_broken_title: "Broken Parts",
    feat_broken_desc: "Registreer beschadigde onderdelen per werkpost en project. Voeg afbeeldingen toe en bekijk samenvattingen met grafieken. Omzetten naar spoedopdracht.",
    feat_broken_bullets: "Werkpost- en projectgebonden|Afbeeldingen toevoegen|Samenvatting met grafieken|Omzetten naar spoedopdracht",

    feat_hr_title: "Personeelsbeheer",
    feat_hr_desc: "Verlofaanvragen met status via mail naar personeelsdienst en aanvrager. Automatisch inplannen in installatie- en productieplanning.",
    feat_hr_bullets: "Verlofaanvragen & goedkeuring|Status via e-mail|Automatische planning integratie|Vakantieplanner overzicht",

    // Solutions page
    solutions_title: "Welke problemen lost het op?",
    solutions_subtitle: "AutoMattiOn Compass pakt de kernproblemen aan waar productiebedrijven dagelijks mee worstelen.",

    sol_efficiency_title: "Operationele Efficiëntie",
    sol_efficiency_problem: "Handmatige planning leidt tot verkeerde capaciteitsinschatting en deadlineoverschrijdingen.",
    sol_efficiency_solution: "Geautomatiseerde planning op basis van werkstation-capaciteit, medewerkerbeschikbaarheid en projectprioriteiten.",

    sol_logistics_title: "Logistieke Chaos",
    sol_logistics_problem: "Leveringen komen binnen zonder systeem, onderdelen raken zoek, vrachtwagen laden is inefficiënt.",
    sol_logistics_solution: "Barcode scanning voor leveringen, gestructureerde laadplanning met teamkleuren en tracking van externe verwerking.",

    sol_flexibility_title: "Flexibiliteit",
    sol_flexibility_problem: "Planningen zijn statisch, wijzigingen zijn tijdrovend.",
    sol_flexibility_solution: "Drag-and-drop planning, resizable taken in Gantt, conflict resolvers voor dubbele toewijzingen.",

    sol_communication_title: "Communicatie Gaten",
    sol_communication_problem: "Spoedorders en wijzigingen bereiken de juiste mensen niet tijdig.",
    sol_communication_solution: "Rush order systeem met directe notificaties, project-specifieke chat en ongelezen-berichten tracking.",

    sol_problem: "Probleem",
    sol_solution: "Oplossing",

    // Integration page
    integration_title: "Integratie met CrownBase Pro",
    integration_subtitle: "Naadloze koppeling met uw bestaande bedrijfssoftware voor een volledig digitaal ecosysteem.",
    integration_sync: "Automatische Synchronisatie",
    integration_sync_desc: "Elke 2 uur worden bestellingen, statusupdates en installatiedatums gesynchroniseerd tussen AutoMattiOn Compass en CrownBase Pro.",
    integration_import: "Importeren Bestellingen",
    integration_import_desc: "Bestellingen worden automatisch geïmporteerd in het juiste project met volledige artikeldetails.",
    integration_confirm: "Ontvangstbevestiging",
    integration_confirm_desc: "Leveringsbevestigingen worden teruggestuurd naar CrownBase Pro voor naadloze opvolging.",
    integration_api: "Vrijblijvende API Connectie",
    integration_api_desc: "Open API architectuur maakt integratie met andere systemen eenvoudig mogelijk.",

    // Tech stack
    tech_title: "Opbouw Software",
    tech_subtitle: "Gebouwd met moderne, betrouwbare technologieën.",
    tech_typescript: "TypeScript voor betrouwbare, onderhoudbare code",
    tech_supabase: "Supabase PostgreSQL database voor real-time data",
    tech_react: "React componentgebaseerde gebruikersinterfaces",
    tech_tailwind: "Tailwind CSS voor flexibele, responsive styling",
    tech_vite: "Vite voor snelle ontwikkeling en bundling",
    tech_netlify: "Gehost via Netlify met automatische deploys",
    tech_resend: "Automatische mails via ReSend",
    tech_mail_detail: "Wekelijkse projectstatus mail & verlofaanvragen",

    // Contact
    contact_title: "Klaar om uw productie te stroomlijnen?",
    contact_subtitle: "Krijg uw eigen dedicated omgeving op",
    contact_cta: "Contacteer Ons",
    contact_email: "info@automattion-compass.com",
    contact_or: "of mail rechtstreeks naar",

    // Footer
    footer_rights: "Alle rechten voorbehouden.",
    footer_developer: "Developer Toegang",
    footer_privacy: "Privacy",
    footer_terms: "Voorwaarden",
  },

  en: {
    nav_features: "Features",
    nav_solutions: "Solutions",
    nav_integration: "Integration",
    nav_contact: "Contact",
    nav_demo: "Request Demo",
    nav_login: "Login",
    nav_developer: "Developer Portal",

    hero_badge: "Production planning made simple",
    hero_title_1: "Guiding your production",
    hero_title_2: "to perfection",
    hero_subtitle: "The all-in-one production planning platform for furniture manufacturers. Manage workstations, orders, logistics, and teams — all from one place.",
    hero_cta: "Request a Demo",
    hero_portal: "Thonon Portal",

    pain_title: "Sound familiar?",
    pain_subtitle: "Many production companies struggle with these challenges daily.",
    pain_1: "Planning feels like guessing",
    pain_2: "Rush orders disrupt everything",
    pain_3: "Parts missing, trucks half-loaded",
    pain_4: "Post-calculation happens… never or too late",
    pain_5: "We only see bottlenecks when it's too late",
    pain_6: "Knowledge is in people's heads, not in systems",
    pain_7: "We work in five tools that share nothing",

    core_title: "Core Values",
    core_subtitle: "Built on modern technology, designed for the production industry.",
    core_web: "Web Application",
    core_web_desc: "Accessible from any browser, on any device. No installation required.",
    core_digital: "Digitalization",
    core_digital_desc: "Complete digitalization of your production environment and administration.",
    core_flex: "Flexibility",
    core_flex_desc: "Suitable for both simple and complex production systems.",
    core_scale: "Scalability",
    core_scale_desc: "Grows with your business. From small workshop to large factory.",
    core_integrate: "Integration",
    core_integrate_desc: "Seamless connection with CrownBase Pro and other systems.",
    core_lang: "Multilingual",
    core_lang_desc: "Language-specific accounts in Dutch, French and English.",
    core_security: "Multi-Tenant",
    core_security_desc: "Each company gets a fully isolated environment.",
    core_care: "Simplified Operations",
    core_care_desc: "Less manual work for staff and administration.",

    features_title: "All Features",
    features_subtitle: "A complete suite of tools designed specifically for furniture and interior manufacturers.",

    feat_project_title: "Project Management",
    feat_project_desc: "Central overview of all projects with client info, deadlines, order lists, accessories and files. Full traceability from intake to delivery.",
    feat_project_bullets: "Order materials & accessories management|Cost overview per project|Link to orders|Mail with project status",

    feat_planning_title: "Production Planning & Gantt",
    feat_planning_desc: "Advanced planning system with Gantt charts, drag-and-drop scheduling and automatic capacity optimization. Person-specific planning with installation date priority.",
    feat_planning_bullets: "Smart auto-assignment of tasks|Feasibility analysis per project|Real-time adjustments|Workload overview per employee",

    feat_rush_title: "Rush Orders",
    feat_rush_desc: "Dedicated rush order system with instant notifications, person and task assignment, deadline tracking and built-in chat.",
    feat_rush_bullets: "Critical priority marking|Time registration per task|Built-in chat per rush order|Dashboard notifications",

    feat_install_title: "Installation Management",
    feat_install_desc: "Complete management of installation teams with planning per team, truck linking and weekly loading schedule.",
    feat_install_bullets: "Split by installation team|Truck loading one day before installation|Convenient dashboards|Weekly loading schedule",

    feat_logistics_title: "Logistics IN & OUT",
    feat_logistics_desc: "Manage incoming deliveries with barcode scanning, delivery confirmation and backorder tracking. Outgoing logistics with external processing timeline.",
    feat_logistics_bullets: "Delivery confirmation with images|Sync with CrownBase Pro|Backorder tracking|External processing timeline",

    feat_time_title: "Time Registration",
    feat_time_desc: "Personal time registrations linked to projects and tasks. Exportable reports and interactive task island with picture-in-picture option.",
    feat_time_bullets: "Linked hourly rate for post-calculation|Export reports|Count up/down timer|Filter by employee, project or task",

    feat_dashboard_title: "Dashboards & Monitoring",
    feat_dashboard_desc: "Real-time production dashboards with workstation overview, active workers, rush orders and production flow visualization.",
    feat_dashboard_bullets: "Workstation control panel|Production flow overview|Active machines & workers|Task timeline per workstation",

    feat_broken_title: "Broken Parts",
    feat_broken_desc: "Register damaged parts per workstation and project. Add images and view summaries with charts. Convert to rush order.",
    feat_broken_bullets: "Workstation & project linked|Add images|Summary with charts|Convert to rush order",

    feat_hr_title: "HR Management",
    feat_hr_desc: "Holiday requests with status via email to HR and requester. Automatic scheduling integration for installation and production planning.",
    feat_hr_bullets: "Holiday requests & approval|Status via email|Automatic planning integration|Holiday planner overview",

    solutions_title: "What problems does it solve?",
    solutions_subtitle: "AutoMattiOn Compass tackles the core problems production companies face daily.",

    sol_efficiency_title: "Operational Efficiency",
    sol_efficiency_problem: "Manual planning leads to wrong capacity estimates and deadline overruns.",
    sol_efficiency_solution: "Automated planning based on workstation capacity, employee availability and project priorities.",

    sol_logistics_title: "Logistics Chaos",
    sol_logistics_problem: "Deliveries arrive without a system, parts get lost, truck loading is inefficient.",
    sol_logistics_solution: "Barcode scanning for deliveries, structured loading planning with team colors and external processing tracking.",

    sol_flexibility_title: "Flexibility",
    sol_flexibility_problem: "Schedules are static, changes are time-consuming.",
    sol_flexibility_solution: "Drag-and-drop planning, resizable tasks in Gantt, conflict resolvers for double assignments.",

    sol_communication_title: "Communication Gaps",
    sol_communication_problem: "Rush orders and changes don't reach the right people on time.",
    sol_communication_solution: "Rush order system with instant notifications, project-specific chat and unread message tracking.",

    sol_problem: "Problem",
    sol_solution: "Solution",

    integration_title: "CrownBase Pro Integration",
    integration_subtitle: "Seamless connection with your existing business software for a fully digital ecosystem.",
    integration_sync: "Automatic Synchronization",
    integration_sync_desc: "Every 2 hours, orders, status updates and installation dates are synchronized between AutoMattiOn Compass and CrownBase Pro.",
    integration_import: "Import Orders",
    integration_import_desc: "Orders are automatically imported into the correct project with full article details.",
    integration_confirm: "Delivery Confirmation",
    integration_confirm_desc: "Delivery confirmations are sent back to CrownBase Pro for seamless follow-up.",
    integration_api: "Open API Connection",
    integration_api_desc: "Open API architecture makes integration with other systems straightforward.",

    tech_title: "Technology Stack",
    tech_subtitle: "Built with modern, reliable technologies.",
    tech_typescript: "TypeScript for reliable, maintainable code",
    tech_supabase: "Supabase PostgreSQL database for real-time data",
    tech_react: "React component-based user interfaces",
    tech_tailwind: "Tailwind CSS for flexible, responsive styling",
    tech_vite: "Vite for fast development and bundling",
    tech_netlify: "Hosted via Netlify with automatic deploys",
    tech_resend: "Automatic emails via ReSend",
    tech_mail_detail: "Weekly project status email & holiday requests",

    contact_title: "Ready to streamline your production?",
    contact_subtitle: "Get your own dedicated environment at",
    contact_cta: "Contact Us",
    contact_email: "info@automattion-compass.com",
    contact_or: "or email directly to",

    footer_rights: "All rights reserved.",
    footer_developer: "Developer Access",
    footer_privacy: "Privacy",
    footer_terms: "Terms",
  },

  fr: {
    nav_features: "Fonctionnalités",
    nav_solutions: "Solutions",
    nav_integration: "Intégration",
    nav_contact: "Contact",
    nav_demo: "Demander une Démo",
    nav_login: "Connexion",
    nav_developer: "Portail Développeur",

    hero_badge: "Planification de production simplifiée",
    hero_title_1: "Guidez votre production",
    hero_title_2: "vers la perfection",
    hero_subtitle: "La plateforme de planification de production tout-en-un pour les fabricants de meubles. Gérez les postes de travail, commandes, logistique et équipes — depuis un seul endroit.",
    hero_cta: "Demander une Démo",
    hero_portal: "Portail Thonon",

    pain_title: "Vous reconnaissez ceci ?",
    pain_subtitle: "De nombreuses entreprises de production luttent quotidiennement avec ces défis.",
    pain_1: "La planification ressemble à un jeu de devinettes",
    pain_2: "Les commandes urgentes perturbent tout",
    pain_3: "Pièces manquantes, camions à moitié chargés",
    pain_4: "Le post-calcul arrive… jamais ou trop tard",
    pain_5: "On ne voit les goulots qu'une fois trop tard",
    pain_6: "Le savoir est dans les têtes, pas dans les systèmes",
    pain_7: "Nous travaillons avec cinq outils qui ne partagent rien",

    core_title: "Valeurs Fondamentales",
    core_subtitle: "Construit sur des technologies modernes, conçu pour l'industrie de la production.",
    core_web: "Application Web",
    core_web_desc: "Accessible depuis n'importe quel navigateur, sur n'importe quel appareil. Aucune installation requise.",
    core_digital: "Digitalisation",
    core_digital_desc: "Digitalisation complète de votre environnement de production et administration.",
    core_flex: "Flexibilité",
    core_flex_desc: "Adapté aux systèmes de production simples et complexes.",
    core_scale: "Évolutivité",
    core_scale_desc: "Évolue avec votre entreprise. Du petit atelier à la grande usine.",
    core_integrate: "Intégration",
    core_integrate_desc: "Connexion transparente avec CrownBase Pro et d'autres systèmes.",
    core_lang: "Multilingue",
    core_lang_desc: "Comptes liés à la langue en néerlandais, français et anglais.",
    core_security: "Multi-Tenant",
    core_security_desc: "Chaque entreprise obtient un environnement entièrement isolé.",
    core_care: "Simplification",
    core_care_desc: "Moins de travail manuel pour le personnel et l'administration.",

    features_title: "Toutes les Fonctionnalités",
    features_subtitle: "Une suite complète d'outils conçus spécifiquement pour les fabricants de meubles et d'intérieur.",

    feat_project_title: "Gestion de Projets",
    feat_project_desc: "Aperçu central de tous les projets avec infos client, délais, listes de commandes, accessoires et fichiers. Traçabilité complète de l'admission à la livraison.",
    feat_project_bullets: "Gestion matériaux & accessoires|Aperçu des coûts par projet|Lien vers les commandes|Mail avec statut du projet",

    feat_planning_title: "Planification & Gantt",
    feat_planning_desc: "Système de planification avancé avec diagrammes de Gantt, planification par glisser-déposer et optimisation automatique des capacités.",
    feat_planning_bullets: "Attribution automatique intelligente|Analyse de faisabilité par projet|Ajustements en temps réel|Aperçu charge de travail",

    feat_rush_title: "Commandes Urgentes",
    feat_rush_desc: "Système dédié avec notifications instantanées, attribution de personnes et tâches, suivi des délais et chat intégré.",
    feat_rush_bullets: "Marquage priorité critique|Enregistrement temps par tâche|Chat intégré par commande|Notifications tableau de bord",

    feat_install_title: "Gestion des Installations",
    feat_install_desc: "Gestion complète des équipes d'installation avec planification par équipe, liaison camion et planning de chargement.",
    feat_install_bullets: "Répartition par équipe|Chargement un jour avant|Tableaux de bord pratiques|Planning hebdomadaire",

    feat_logistics_title: "Logistique IN & OUT",
    feat_logistics_desc: "Gérez les livraisons entrantes avec scan de codes-barres, confirmation de livraison et suivi des commandes en retard.",
    feat_logistics_bullets: "Confirmation avec images|Sync CrownBase Pro|Suivi commandes en retard|Timeline traitement externe",

    feat_time_title: "Enregistrement du Temps",
    feat_time_desc: "Enregistrements personnels liés aux projets et tâches. Rapports exportables et îlot de tâches interactif.",
    feat_time_bullets: "Tarif horaire lié pour post-calcul|Exporter rapports|Chronomètre montant/descendant|Filtre par employé, projet ou tâche",

    feat_dashboard_title: "Tableaux de Bord & Monitoring",
    feat_dashboard_desc: "Tableaux de bord de production en temps réel avec aperçu des postes, travailleurs actifs et flux de production.",
    feat_dashboard_bullets: "Panneau de contrôle|Flux de production|Machines & travailleurs actifs|Timeline par poste",

    feat_broken_title: "Pièces Endommagées",
    feat_broken_desc: "Enregistrez les pièces endommagées par poste et projet. Ajoutez des images et consultez les résumés avec graphiques.",
    feat_broken_bullets: "Lié au poste & projet|Ajouter des images|Résumé avec graphiques|Convertir en commande urgente",

    feat_hr_title: "Gestion RH",
    feat_hr_desc: "Demandes de congé avec statut par mail vers RH et demandeur. Intégration automatique dans la planification.",
    feat_hr_bullets: "Demandes & approbation congés|Statut par email|Intégration planification|Aperçu planificateur",

    solutions_title: "Quels problèmes résout-il ?",
    solutions_subtitle: "AutoMattiOn Compass s'attaque aux problèmes fondamentaux des entreprises de production.",

    sol_efficiency_title: "Efficacité Opérationnelle",
    sol_efficiency_problem: "La planification manuelle entraîne des erreurs d'estimation et des dépassements de délais.",
    sol_efficiency_solution: "Planification automatisée basée sur la capacité des postes, la disponibilité et les priorités.",

    sol_logistics_title: "Chaos Logistique",
    sol_logistics_problem: "Les livraisons arrivent sans système, les pièces se perdent, le chargement est inefficace.",
    sol_logistics_solution: "Scan de codes-barres, planification structurée avec couleurs d'équipe et suivi externe.",

    sol_flexibility_title: "Flexibilité",
    sol_flexibility_problem: "Les plannings sont statiques, les modifications prennent du temps.",
    sol_flexibility_solution: "Planification glisser-déposer, tâches redimensionnables, résolution de conflits.",

    sol_communication_title: "Lacunes de Communication",
    sol_communication_problem: "Les commandes urgentes et modifications n'atteignent pas les bonnes personnes à temps.",
    sol_communication_solution: "Système de commandes urgentes avec notifications, chat par projet et suivi des messages.",

    sol_problem: "Problème",
    sol_solution: "Solution",

    integration_title: "Intégration CrownBase Pro",
    integration_subtitle: "Connexion transparente avec votre logiciel existant pour un écosystème entièrement numérique.",
    integration_sync: "Synchronisation Automatique",
    integration_sync_desc: "Toutes les 2 heures, les commandes et statuts sont synchronisés entre AutoMattiOn Compass et CrownBase Pro.",
    integration_import: "Importer les Commandes",
    integration_import_desc: "Les commandes sont automatiquement importées dans le bon projet avec tous les détails.",
    integration_confirm: "Confirmation de Livraison",
    integration_confirm_desc: "Les confirmations sont renvoyées à CrownBase Pro pour un suivi transparent.",
    integration_api: "Connexion API Ouverte",
    integration_api_desc: "L'architecture API ouverte facilite l'intégration avec d'autres systèmes.",

    tech_title: "Stack Technologique",
    tech_subtitle: "Construit avec des technologies modernes et fiables.",
    tech_typescript: "TypeScript pour un code fiable et maintenable",
    tech_supabase: "Base de données Supabase PostgreSQL en temps réel",
    tech_react: "Interfaces React basées sur des composants",
    tech_tailwind: "Tailwind CSS pour un style flexible et responsive",
    tech_vite: "Vite pour un développement et bundling rapide",
    tech_netlify: "Hébergé via Netlify avec déploiements automatiques",
    tech_resend: "Emails automatiques via ReSend",
    tech_mail_detail: "Email hebdomadaire statut projet & demandes de congé",

    contact_title: "Prêt à optimiser votre production ?",
    contact_subtitle: "Obtenez votre propre environnement dédié sur",
    contact_cta: "Contactez-Nous",
    contact_email: "info@automattion-compass.com",
    contact_or: "ou envoyez un email directement à",

    footer_rights: "Tous droits réservés.",
    footer_developer: "Accès Développeur",
    footer_privacy: "Confidentialité",
    footer_terms: "Conditions",
  },
};

export default marketing;
