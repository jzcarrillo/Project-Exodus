export interface Field {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: string[];
}

export interface Section {
  title: string;
  fields: Field[];
}

export interface ServiceDefinition {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  sections: Section[];
  documents: string[];
}

const f = (key: string, label: string, type = 'text', required = true, options?: string[]): Field => ({
  key,
  label,
  type,
  required,
  options,
});

const personal: Section = {
  title: 'Personal information',
  fields: [
    f('firstName', 'Given name'),
    f('lastName', 'Last name'),
    f('birthDate', 'Date of birth', 'date'),
    f('nationality', 'Nationality'),
    f('email', 'Email address', 'email'),
    f('phone', 'Contact number', 'tel'),
  ],
};

const passport: Section = {
  title: 'Passport information',
  fields: [
    f('passportNumber', 'Passport number'),
    f('passportCountry', 'Issuing country'),
    f('passportExpiry', 'Passport expiry date', 'date'),
  ],
};

const address: Section = {
  title: 'Philippine residential address',
  fields: [
    f('street', 'House / unit, building, street'),
    f('barangay', 'Barangay'),
    f('city', 'City / municipality'),
    f('province', 'Province'),
    f('postalCode', 'Postal code'),
  ],
};

const travel: Section = {
  title: 'Travel information',
  fields: [
    f('travelDate', 'Travel date', 'date'),
    f('flightNumber', 'Flight / vessel number'),
    f('port', 'Port of arrival / departure'),
    f('origin', 'Country of origin'),
    f('destination', 'Country of destination'),
  ],
};

const application: Section = {
  title: 'Application information',
  fields: [f('purpose', 'Purpose of application'), f('remarks', 'Additional information', 'textarea', false)],
};

const school: Section = {
  title: 'School and enrollment',
  fields: [
    f('schoolName', 'School name'),
    f('schoolAddress', 'School address'),
    f('course', 'Course / program'),
    f('studentNumber', 'Student number'),
    f('schoolYear', 'Academic year'),
    f('enrollmentDate', 'Enrollment date', 'date'),
  ],
};

const docs = ['Passport bio page', 'Supporting documents'];

export const SERVICES: ServiceDefinition[] = [
  {
    id: 'etravel',
    name: 'eTravel',
    category: 'Travel',
    icon: 'plane',
    description: 'Register your arrival or departure and keep your travel record in one place.',
    sections: [
      {
        title: 'Journey details',
        fields: [
          f('direction', 'Travel direction', 'select', true, ['Arrival', 'Departure']),
          f('transport', 'Mode of travel', 'select', true, ['Air', 'Sea']),
        ],
      },
      personal,
      passport,
      travel,
      address,
    ],
    documents: ['Passport bio page'],
  },
  {
    id: 'visa-waiver',
    name: 'Visa waiver',
    category: 'Stay',
    icon: 'globe',
    description: 'Apply for a visa waiver with a guided application.',
    sections: [application, personal, passport, travel, address],
    documents: docs,
  },
  {
    id: 'student-visa',
    name: 'Student visa conversion',
    category: 'Study',
    icon: 'graduation',
    description: 'Submit your student visa conversion and enrollment details.',
    sections: [application, personal, passport, travel, address, school],
    documents: [...docs, 'Facial image', 'Enrollment certificate'],
  },
  {
    id: 'study-permit',
    name: 'Special study permit',
    category: 'Study',
    icon: 'book',
    description: 'Apply for a permit for your studies in the Philippines.',
    sections: [application, personal, passport, travel, address, school],
    documents: [...docs, 'Facial image', 'Enrollment certificate'],
  },
  {
    id: 'cruise-waiver',
    name: 'Cruise visa waiver',
    category: 'Travel',
    icon: 'ship',
    description: 'Manage a cruise application and upload passenger manifests.',
    sections: [
      application,
      personal,
      passport,
      travel,
      address,
      {
        title: 'Vessel and voyage',
        fields: [
          f('vesselName', 'Vessel name'),
          f('imoNumber', 'IMO number'),
          f('voyageNumber', 'Voyage number'),
          f('company', 'Company name'),
          f('representative', 'Authorized representative'),
        ],
      },
    ],
    documents: [...docs, 'Passenger manifest (.xlsx)'],
  },
  {
    id: 'accreditation',
    name: 'Accreditation',
    category: 'Organization',
    icon: 'building',
    description: 'Submit your organization’s accreditation application.',
    sections: [
      application,
      personal,
      travel,
      address,
      {
        title: 'Company information',
        fields: [
          f('company', 'Company name'),
          f('registrationNumber', 'Company registration number'),
          f('companyAddress', 'Company address'),
        ],
      },
    ],
    documents: ['Facial image', 'Company registration', 'Supporting documents'],
  },
  {
    id: 'annual-report',
    name: 'Annual report',
    category: 'Stay',
    icon: 'calendar',
    description: 'Complete your annual report with your ACR I-Card information.',
    sections: [
      application,
      personal,
      passport,
      address,
      {
        title: 'ACR I-Card information',
        fields: [
          f('acrNumber', 'ACR I-Card number'),
          f('acrExpiry', 'ACR I-Card expiry', 'date'),
          f('reportYear', 'Reporting year', 'number'),
        ],
      },
    ],
    documents: [...docs, 'Facial image', 'ACR I-Card'],
  },
  {
    id: 'school-registration',
    name: 'Existing school registration',
    category: 'Organization',
    icon: 'school',
    description: 'Register your school, courses, and liaison officer.',
    sections: [
      {
        title: 'School information',
        fields: [
          f('schoolName', 'School name'),
          f('schoolAddress', 'School address'),
          f('courses', 'Courses offered', 'textarea'),
          f('accreditationNumber', 'Accreditation number'),
          f('accreditationExpiry', 'Accreditation expiry', 'date'),
        ],
      },
      {
        title: 'Liaison officer',
        fields: [
          f('firstName', 'Given name'),
          f('lastName', 'Last name'),
          f('email', 'Email address', 'email'),
          f('phone', 'Contact number', 'tel'),
        ],
      },
    ],
    documents: ['School accreditation', 'Supporting documents'],
  },
  {
    id: 'dual-citizenship',
    name: 'Dual citizenship',
    category: 'Citizenship',
    icon: 'flag',
    description: 'Apply with your personal, passport, and dependent information.',
    sections: [
      application,
      personal,
      passport,
      address,
      {
        title: 'Dependent information',
        fields: [f('dependents', 'Dependents — names, birth dates, and relationship (or None)', 'textarea')],
      },
    ],
    documents: [...docs, 'Facial image', 'Citizenship documents'],
  },
  {
    id: 'weg',
    name: 'Waiver of exclusion grounds',
    category: 'Travel',
    icon: 'users',
    description: 'Provide travel, companion, and parent or guardian information.',
    sections: [
      application,
      personal,
      passport,
      travel,
      {
        title: 'Companion and legal guardian',
        fields: [
          f('companionName', 'Companion’s full name'),
          f('companionRelationship', 'Relationship to traveler'),
          f('guardianName', 'Parent / legal guardian’s full name'),
          f('guardianPassport', 'Parent / guardian’s passport number'),
          f('guardianPassportExpiry', 'Parent / guardian’s passport expiry', 'date'),
          f('guardianNationality', 'Parent / guardian’s nationality'),
        ],
      },
    ],
    documents: [...docs, 'Facial image', 'Parent / guardian passport', 'Proof of relationship'],
  },
];

export function validateApplicationFields(serviceId: string, data: Record<string, string>): string[] {
  const s = SERVICES.find((item) => item.id === serviceId);
  if (!s) return ['Unknown service'];
  return s.sections
    .flatMap((sec) => sec.fields)
    .flatMap((fld) => {
      const val = data[fld.key]?.trim();
      if (!val) return fld.required ? [fld.label] : [];
      if ((fld.key === 'passportNumber' || fld.key === 'guardianPassport') && val.length !== 9) {
        return [`${fld.label} must be exactly 9 characters`];
      }
      if (fld.options && !fld.options.includes(val)) return [`${fld.label} (invalid option)`];
      if (fld.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return [`${fld.label} (invalid email)`];
      if (fld.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(val) || Number.isNaN(Date.parse(val))))
        return [`${fld.label} (invalid date)`];
      if (fld.key === 'birthDate' && val > new Date().toISOString().slice(0, 10))
        return ['Date of birth cannot be in the future'];
      if (fld.type === 'number' && !/^\d+$/.test(val)) return [`${fld.label} (must be a number)`];
      return [];
    });
}
