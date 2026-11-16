export interface UpazilaOption {
  name: string;
  bnName: string;
  postalCodes: string[];
}

export interface DistrictOption {
  name: string;
  bnName: string;
  zone: 'dhaka_metro' | 'dhaka_suburb' | 'major_city' | 'nationwide';
  upazilas: UpazilaOption[];
}

export interface DivisionOption {
  name: string;
  bnName: string;
  districts: DistrictOption[];
}

export const BANGLADESH_DIVISIONS: DivisionOption[] = [
  {
    name: 'Dhaka',
    bnName: 'ঢাকা',
    districts: [
      {
        name: 'Dhaka',
        bnName: 'ঢাকা',
        zone: 'dhaka_metro',
        upazilas: [
          { name: 'Dhanmondi', bnName: 'ধানমন্ডি', postalCodes: ['1205', '1209'] },
          { name: 'Gulshan', bnName: 'গুলশান', postalCodes: ['1212'] },
          { name: 'Banani', bnName: 'বনানী', postalCodes: ['1213'] },
          { name: 'Mirpur', bnName: 'মিরপুর', postalCodes: ['1216', '1218'] },
          { name: 'Uttara', bnName: 'উত্তরা', postalCodes: ['1230'] },
          { name: 'Mohammadpur', bnName: 'মোহাম্মদপুর', postalCodes: ['1207'] },
          { name: 'Motijheel', bnName: 'মতিঝিল', postalCodes: ['1000'] },
          { name: 'Badda', bnName: 'বাড্ডা', postalCodes: ['1212'] },
          { name: 'Tejgaon', bnName: 'তেজগাঁও', postalCodes: ['1215'] },
          { name: 'Savar', bnName: 'সাভার', postalCodes: ['1340'] },
          { name: 'Keraniganj', bnName: 'কেরানীগঞ্জ', postalCodes: ['1310'] },
        ],
      },
      {
        name: 'Gazipur',
        bnName: 'গাজীপুর',
        zone: 'dhaka_suburb',
        upazilas: [
          { name: 'Gazipur Sadar', bnName: 'গাজীপুর সদর', postalCodes: ['1700'] },
          { name: 'Tongi', bnName: 'টঙ্গী', postalCodes: ['1710'] },
          { name: 'Kaliakair', bnName: 'কালিয়াকৈর', postalCodes: ['1750'] },
          { name: 'Sreepur', bnName: 'শ্রীপুর', postalCodes: ['1740'] },
        ],
      },
      {
        name: 'Narayanganj',
        bnName: 'নারায়ণগঞ্জ',
        zone: 'dhaka_suburb',
        upazilas: [
          { name: 'Narayanganj Sadar', bnName: 'নারায়ণগঞ্জ সদর', postalCodes: ['1400'] },
          { name: 'Siddhirganj', bnName: 'সিদ্ধিরগঞ্জ', postalCodes: ['1430'] },
          { name: 'Fatullah', bnName: 'ফতুল্লা', postalCodes: ['1420'] },
          { name: 'Rupganj', bnName: 'রূপগঞ্জ', postalCodes: ['1460'] },
        ],
      },
      {
        name: 'Tangail',
        bnName: 'টাঙ্গাইল',
        zone: 'nationwide',
        upazilas: [
          { name: 'Tangail Sadar', bnName: 'টাঙ্গাইল সদর', postalCodes: ['1900'] },
          { name: 'Mirzapur', bnName: 'মির্জাপুর', postalCodes: ['1940'] },
          { name: 'Madhupur', bnName: 'মধুপুর', postalCodes: ['1996'] },
        ],
      },
    ],
  },
  {
    name: 'Chattogram',
    bnName: 'চট্টগ্রাম',
    districts: [
      {
        name: 'Chattogram',
        bnName: 'চট্টগ্রাম',
        zone: 'major_city',
        upazilas: [
          { name: 'Panchlaish', bnName: 'পাঁচলাইশ', postalCodes: ['4203'] },
          { name: 'Kotwali', bnName: 'কোতোয়ালী', postalCodes: ['4000'] },
          { name: 'Halishahar', bnName: 'হালিশহর', postalCodes: ['4216'] },
          { name: 'Agrabad (Double Mooring)', bnName: 'আগ্রাবাদ', postalCodes: ['4100'] },
          { name: 'Patenga', bnName: 'পতেঙ্গা', postalCodes: ['4204'] },
          { name: 'Sitakunda', bnName: 'সীতাকুণ্ড', postalCodes: ['4310'] },
        ],
      },
      {
        name: "Cox's Bazar",
        bnName: 'কক্সবাজার',
        zone: 'nationwide',
        upazilas: [
          { name: "Cox's Bazar Sadar", bnName: 'কক্সবাজার সদর', postalCodes: ['4700'] },
          { name: 'Chakaria', bnName: 'চকরিয়া', postalCodes: ['4741'] },
          { name: 'Teknaf', bnName: 'টেকনাফ', postalCodes: ['4760'] },
        ],
      },
      {
        name: 'Cumilla',
        bnName: 'কুমিল্লা',
        zone: 'major_city',
        upazilas: [
          { name: 'Cumilla Adarsha Sadar', bnName: 'কুমিল্লা আদর্শ সদর', postalCodes: ['3500'] },
          { name: 'Daudkandi', bnName: 'দাউদকান্দি', postalCodes: ['3516'] },
          { name: 'Laksam', bnName: 'লাকসাম', postalCodes: ['3570'] },
        ],
      },
    ],
  },
  {
    name: 'Rajshahi',
    bnName: 'রাজশাহী',
    districts: [
      {
        name: 'Rajshahi',
        bnName: 'রাজশাহী',
        zone: 'major_city',
        upazilas: [
          { name: 'Boalia', bnName: 'বোয়ালিয়া', postalCodes: ['6000'] },
          { name: 'Motihar', bnName: 'মতিহার', postalCodes: ['6205'] },
          { name: 'Shah Makhdum', bnName: 'শাহ মখদুম', postalCodes: ['6203'] },
        ],
      },
      {
        name: 'Bogura',
        bnName: 'বগুড়া',
        zone: 'nationwide',
        upazilas: [
          { name: 'Bogura Sadar', bnName: 'বগুড়া সদর', postalCodes: ['5800'] },
          { name: 'Sherpur', bnName: 'শেরপুর', postalCodes: ['5840'] },
        ],
      },
    ],
  },
  {
    name: 'Khulna',
    bnName: 'খুলনা',
    districts: [
      {
        name: 'Khulna',
        bnName: 'খুলনা',
        zone: 'major_city',
        upazilas: [
          { name: 'Khulna Sadar', bnName: 'খুলনা সদর', postalCodes: ['9100'] },
          { name: 'Sonadanga', bnName: 'সোনাডাঙ্গা', postalCodes: ['9000'] },
          { name: 'Khalishpur', bnName: 'খালিশপুর', postalCodes: ['9000'] },
        ],
      },
      {
        name: 'Jashore',
        bnName: 'যশোর',
        zone: 'nationwide',
        upazilas: [
          { name: 'Jashore Sadar', bnName: 'যশোর সদর', postalCodes: ['7400'] },
          { name: 'Benapole (Sharsha)', bnName: 'বেনাপোল', postalCodes: ['7431'] },
        ],
      },
    ],
  },
  {
    name: 'Sylhet',
    bnName: 'সিলেট',
    districts: [
      {
        name: 'Sylhet',
        bnName: 'সিলেট',
        zone: 'major_city',
        upazilas: [
          { name: 'Sylhet Sadar', bnName: 'সিলেট সদর', postalCodes: ['3100'] },
          { name: 'Jalalabad', bnName: 'জালালাবাদ', postalCodes: ['3100'] },
          { name: 'Beanibazar', bnName: 'বিয়ানীবাজার', postalCodes: ['3170'] },
        ],
      },
      {
        name: 'Moulvibazar',
        bnName: 'মৌলভীবাজার',
        zone: 'nationwide',
        upazilas: [
          { name: 'Moulvibazar Sadar', bnName: 'মৌলভীবাজার সদর', postalCodes: ['3200'] },
          { name: 'Sreemangal', bnName: 'শ্রীমঙ্গল', postalCodes: ['3210'] },
        ],
      },
    ],
  },
  {
    name: 'Barishal',
    bnName: 'বরিশাল',
    districts: [
      {
        name: 'Barishal',
        bnName: 'বরিশাল',
        zone: 'major_city',
        upazilas: [
          { name: 'Barishal Sadar', bnName: 'বরিশাল সদর', postalCodes: ['8200'] },
          { name: 'Bakerganj', bnName: 'বাকেরগঞ্জ', postalCodes: ['8280'] },
        ],
      },
    ],
  },
  {
    name: 'Rangpur',
    bnName: 'রংপুর',
    districts: [
      {
        name: 'Rangpur',
        bnName: 'রংপুর',
        zone: 'major_city',
        upazilas: [
          { name: 'Rangpur Sadar', bnName: 'রংপুর সদর', postalCodes: ['5400'] },
          { name: 'Mithapukur', bnName: 'মিঠাপুকুর', postalCodes: ['5460'] },
        ],
      },
      {
        name: 'Dinajpur',
        bnName: 'দিনাজপুর',
        zone: 'nationwide',
        upazilas: [
          { name: 'Dinajpur Sadar', bnName: 'দিনাজপুর সদর', postalCodes: ['5200'] },
          { name: 'Parbatipur', bnName: 'পার্বতীপুর', postalCodes: ['5250'] },
        ],
      },
    ],
  },
  {
    name: 'Mymensingh',
    bnName: 'ময়মনসিংহ',
    districts: [
      {
        name: 'Mymensingh',
        bnName: 'ময়মনসিংহ',
        zone: 'major_city',
        upazilas: [
          { name: 'Mymensingh Sadar', bnName: 'ময়মনসিংহ সদর', postalCodes: ['2200'] },
          { name: 'Trishal', bnName: 'ত্রিশাল', postalCodes: ['2220'] },
        ],
      },
    ],
  },
];

export function validateBangladeshAddressHierarchy(
  division: string,
  district: string,
  upazila: string
): { valid: boolean; zone?: DistrictOption['zone']; reason?: string } {
  const div = BANGLADESH_DIVISIONS.find((d) => d.name.toLowerCase() === division.trim().toLowerCase());
  if (!div) {
    return { valid: false, reason: `Unsupported division: ${division}` };
  }
  const dist = div.districts.find((d) => d.name.toLowerCase() === district.trim().toLowerCase());
  if (!dist) {
    return { valid: false, reason: `District "${district}" does not belong to Division "${div.name}"` };
  }
  const upz = dist.upazilas.find((u) => u.name.toLowerCase() === upazila.trim().toLowerCase());
  if (!upz) {
    return { valid: false, reason: `Upazila/Thana "${upazila}" does not belong to District "${dist.name}"` };
  }
  return { valid: true, zone: dist.zone };
}

export function isValidBangladeshPhone(phone: string): boolean {
  const normalized = phone.replace(/[\s-]/g, '');
  return /^(\+?88)?01[3-9]\d{8}$/.test(normalized);
}
