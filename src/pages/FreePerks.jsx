import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Gift, Cake, GraduationCap, Baby, Heart, Star, PartyPopper,
  Search, ExternalLink, Copy, CheckCircle, Plus, Trash2,
  Calendar, MapPin, Tag, Clock, Info, Sparkles, Trophy,
  Users, AlertTriangle,
} from 'lucide-react';
import { incognito } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useActiveProfile } from '@/hooks/useActiveProfile';
import { motion, AnimatePresence } from 'framer-motion';

const OCCASIONS = [
  { id: 'birthday', label: 'Birthday', icon: Cake, color: 'from-pink-600 to-rose-500', badge: 'bg-pink-500/20 text-pink-300' },
  { id: 'graduation', label: 'Graduation', icon: GraduationCap, color: 'from-blue-600 to-indigo-500', badge: 'bg-blue-500/20 text-blue-300' },
  { id: 'anniversary', label: 'Anniversary', icon: Heart, color: 'from-red-600 to-pink-500', badge: 'bg-red-500/20 text-red-300' },
  { id: 'new_baby', label: 'New Baby', icon: Baby, color: 'from-purple-600 to-violet-500', badge: 'bg-purple-500/20 text-purple-300' },
  { id: 'loyalty', label: 'Loyalty Rewards', icon: Star, color: 'from-amber-600 to-yellow-500', badge: 'bg-amber-500/20 text-amber-300' },
  { id: 'signup', label: 'Free Sign-Up', icon: PartyPopper, color: 'from-green-600 to-emerald-500', badge: 'bg-green-500/20 text-green-300' },
  { id: 'veterans', label: 'Veterans / Military', icon: Trophy, color: 'from-slate-600 to-zinc-500', badge: 'bg-slate-500/20 text-slate-300' },
  { id: 'seniors', label: 'Seniors', icon: Users, color: 'from-teal-600 to-cyan-500', badge: 'bg-teal-500/20 text-teal-300' },
];

const CATEGORIES = [
  { id: 'food', label: 'Food & Drink' },
  { id: 'retail', label: 'Retail & Shopping' },
  { id: 'beauty', label: 'Beauty & Wellness' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'travel', label: 'Travel & Hotels' },
  { id: 'services', label: 'Services' },
  { id: 'other', label: 'Other' },
];

const BUILT_IN_PERKS = [
  // BIRTHDAY
  { company: 'Starbucks', perk: 'Free handcrafted drink (any size)', occasion: 'birthday', category: 'food', requirement: 'Starbucks Rewards member (free to join)', url: 'https://www.starbucks.com/rewards', howTo: 'Join Starbucks Rewards at least 7 days before your birthday. The free drink reward appears in the app on your birthday.' },
  { company: 'Denny\'s', perk: 'Free Grand Slam breakfast', occasion: 'birthday', category: 'food', requirement: 'Show valid ID', url: 'https://www.dennys.com', howTo: 'Visit any Denny\'s on your birthday with a valid photo ID. The Grand Slam is completely free with no purchase required.' },
  { company: 'IHOP', perk: 'Free stack of Rooty Tooty Fresh \'N Fruity pancakes', occasion: 'birthday', category: 'food', requirement: 'International Bank of Pancakes loyalty member', url: 'https://www.ihop.com/en/ihop-rewards', howTo: 'Sign up for IHOP rewards and add your birthday. A free pancake offer will be emailed to you.' },
  { company: 'Sephora', perk: 'Free birthday gift (mini product set)', occasion: 'birthday', category: 'beauty', requirement: 'Beauty Insider member (free)', url: 'https://www.sephora.com/beauty/birthday-gift', howTo: 'Join Beauty Insider (free), add your birthday. Redeem in-store or online during your birthday month.' },
  { company: 'Ulta Beauty', perk: 'Free birthday gift + bonus points', occasion: 'birthday', category: 'beauty', requirement: 'Ultamate Rewards member (free)', url: 'https://www.ulta.com/rewards', howTo: 'Sign up for Ultamate Rewards. Gift coupon is emailed during your birthday month.' },
  { company: 'Nothing Bundt Cakes', perk: 'Free bundtlet cake', occasion: 'birthday', category: 'food', requirement: 'eClub member (free email signup)', url: 'https://www.nothingbundtcakes.com/eclub', howTo: 'Join the eClub and add your birthday. A free bundtlet coupon arrives via email during your birthday month.' },
  { company: 'Baskin-Robbins', perk: 'Free scoop of ice cream', occasion: 'birthday', category: 'food', requirement: 'Baskin-Robbins Rewards member', url: 'https://www.baskinrobbins.com/en/rewards', howTo: 'Download the app and join rewards. Your birthday reward will appear in the app.' },
  { company: 'Panera Bread', perk: 'Free pastry or sweet treat', occasion: 'birthday', category: 'food', requirement: 'MyPanera member (free)', url: 'https://www.panerabread.com/en-us/mypanera.html', howTo: 'Sign up for MyPanera and enter your birthday. Reward arrives in your account during birthday month.' },
  { company: 'Cracker Barrel', perk: 'Free dessert (chocolate coca-cola cake slice)', occasion: 'birthday', category: 'food', requirement: 'Dine in on your birthday', url: 'https://www.crackerbarrel.com', howTo: 'Inform your server it\'s your birthday. A complimentary dessert is provided.' },
  { company: 'Red Robin', perk: 'Free birthday burger', occasion: 'birthday', category: 'food', requirement: 'Red Robin Royalty member (free)', url: 'https://www.redrobin.com/royalty', howTo: 'Join Red Robin Royalty and add your birthday. A free burger reward appears during your birthday month.' },
  { company: 'Firehouse Subs', perk: 'Free medium sub', occasion: 'birthday', category: 'food', requirement: 'Firehouse Rewards member', url: 'https://www.firehousesubs.com/rewards', howTo: 'Sign up for Firehouse Rewards with your birthday. Reward is emailed to you.' },
  { company: 'Chili\'s', perk: 'Free dessert (molten chocolate cake or similar)', occasion: 'birthday', category: 'food', requirement: 'My Chili\'s Rewards member', url: 'https://www.chilis.com/my-chilis', howTo: 'Join My Chili\'s Rewards. Birthday reward appears in the app.' },
  { company: 'Dairy Queen', perk: 'Free Blizzard (buy one get one free)', occasion: 'birthday', category: 'food', requirement: 'DQ Rewards member', url: 'https://www.dairyqueen.com/us-en/DQ-Rewards/', howTo: 'Join DQ Rewards and enter your birthday. BOGO Blizzard coupon sent to your app.' },
  { company: 'Dunkin\'', perk: 'Free drink (any size)', occasion: 'birthday', category: 'food', requirement: 'Dunkin\' Rewards member', url: 'https://www.dunkindonuts.com/en/dd-perks', howTo: 'Sign up for Dunkin\' Rewards. Free beverage coupon appears on your birthday.' },
  { company: 'Krispy Kreme', perk: 'Free doughnut + free dozen on birthday', occasion: 'birthday', category: 'food', requirement: 'Krispy Kreme Rewards member', url: 'https://www.krispykreme.com/rewards', howTo: 'Join Krispy Kreme Rewards. You get a free doughnut on your birthday plus a free dozen coupon.' },
  { company: 'Moe\'s Southwest Grill', perk: 'Free burrito', occasion: 'birthday', category: 'food', requirement: 'Moe Rewards member', url: 'https://www.moes.com/rewards', howTo: 'Sign up for Moe Rewards. Birthday burrito reward loads into your account.' },
  { company: 'Jersey Mike\'s', perk: 'Free regular sub + 22oz drink', occasion: 'birthday', category: 'food', requirement: 'MyMike\'s Rewards member', url: 'https://www.jerseymikes.com/mymikes', howTo: 'Join MyMike\'s Rewards and add your birthday.' },
  { company: 'Cinnabon', perk: 'Free Minibon cinnamon roll', occasion: 'birthday', category: 'food', requirement: 'Cinnabon Rewards member', url: 'https://www.cinnabon.com/rewards', howTo: 'Sign up for Cinnabon Rewards. Birthday reward is sent via the app.' },
  { company: 'Auntie Anne\'s', perk: 'Free pretzel', occasion: 'birthday', category: 'food', requirement: 'Pretzel Perks member', url: 'https://www.auntieannes.com/rewards', howTo: 'Join Pretzel Perks and add your birthday.' },
  { company: 'Aveda', perk: 'Free birthday gift (travel-size product)', occasion: 'birthday', category: 'beauty', requirement: 'Sign up with email and birthday', url: 'https://www.aveda.com/birthday', howTo: 'Register on aveda.com with your birthday. Redeem your gift in-store during your birthday month.' },
  { company: 'DSW', perk: '$5 birthday reward', occasion: 'birthday', category: 'retail', requirement: 'DSW VIP member (free)', url: 'https://www.dsw.com/en/us/rewards', howTo: 'Join DSW VIP Rewards. $5 certificate is emailed during your birthday month.' },
  { company: 'Dillard\'s', perk: 'Birthday discount coupon', occasion: 'birthday', category: 'retail', requirement: 'Rewards member', url: 'https://www.dillards.com', howTo: 'Sign up for Dillard\'s rewards program and add your birthday.' },
  { company: 'AMC Theatres', perk: 'Free large popcorn', occasion: 'birthday', category: 'entertainment', requirement: 'AMC Stubs member', url: 'https://www.amctheatres.com/amcstubs', howTo: 'Join AMC Stubs (free tier available). Birthday popcorn reward appears in your account.' },
  { company: 'Dave & Buster\'s', perk: 'Free $10 game play', occasion: 'birthday', category: 'entertainment', requirement: 'D&B Rewards member', url: 'https://www.daveandbusters.com/rewards', howTo: 'Sign up for D&B Rewards. Birthday credits are loaded to your card.' },
  { company: 'Kohl\'s', perk: 'Birthday discount (varies)', occasion: 'birthday', category: 'retail', requirement: 'Yes2You Rewards member', url: 'https://www.kohls.com/feature/rewards.jsp', howTo: 'Join Kohl\'s Rewards and add your birthday.' },
  { company: 'Subway', perk: 'Free cookie or BOGO Footlong', occasion: 'birthday', category: 'food', requirement: 'Subway MVP Rewards member', url: 'https://www.subway.com/en-us/menunutrition/rewards', howTo: 'Sign up for Subway MVP Rewards. Birthday offer appears in the app.' },
  { company: 'Smoothie King', perk: 'Free smoothie', occasion: 'birthday', category: 'food', requirement: 'Healthy Rewards member', url: 'https://www.smoothieking.com/healthy-rewards', howTo: 'Join Healthy Rewards. Free smoothie coupon is sent for your birthday.' },
  { company: 'Insomnia Cookies', perk: 'Free cookie', occasion: 'birthday', category: 'food', requirement: 'CookieMagic Rewards member', url: 'https://insomniacookies.com/rewards', howTo: 'Join CookieMagic Rewards. Free cookie reward appears on your birthday.' },
  { company: 'Noodles & Company', perk: 'Free crispy or regular reward', occasion: 'birthday', category: 'food', requirement: 'Noodles Rewards member', url: 'https://www.noodles.com/rewards', howTo: 'Sign up for Noodles Rewards and add your birthday.' },

  // GRADUATION
  { company: 'Krispy Kreme', perk: 'Free dozen doughnuts for graduates', occasion: 'graduation', category: 'food', requirement: 'Show up in cap & gown or with diploma/announcement', url: 'https://www.krispykreme.com', howTo: 'Visit on graduation promotion day wearing your cap & gown or bring your diploma. One free dozen per graduate.' },
  { company: 'Einstein Bros. Bagels', perk: 'Free bagel & shmear for graduates', occasion: 'graduation', category: 'food', requirement: 'Show student ID or wear cap & gown', url: 'https://www.einsteinbros.com', howTo: 'Visit during graduation promotion period with proof of graduation.' },
  { company: 'Chick-fil-A', perk: 'Free breakfast item (select locations)', occasion: 'graduation', category: 'food', requirement: 'Varies by franchise', url: 'https://www.chick-fil-a.com', howTo: 'Check your local Chick-fil-A for graduate promotions, typically around May-June.' },
  { company: 'JOANN Fabrics', perk: '20% off for teachers/graduates (seasonal)', occasion: 'graduation', category: 'retail', requirement: 'Student ID or diploma', url: 'https://www.joann.com', howTo: 'Check JOANN\'s seasonal promotions during graduation season.' },
  { company: 'Apple', perk: 'Education pricing (save up to $200 on Mac, free AirPods)', occasion: 'graduation', category: 'retail', requirement: 'Valid student/graduate status', url: 'https://www.apple.com/us-edu/store', howTo: 'Access Apple Education Store. Back-to-school promotions include free AirPods with Mac purchase. Available to current and newly accepted students.' },
  { company: 'Best Buy', perk: 'Student deals hub (exclusive graduate discounts)', occasion: 'graduation', category: 'retail', requirement: 'Verified student status', url: 'https://www.bestbuy.com/site/back-to-school/college-student-deals/pcmcat748300659857.c', howTo: 'Verify student status on bestbuy.com for exclusive discounts on laptops, tablets, and more.' },
  { company: 'Samsung', perk: 'Education discount (up to 30% off)', occasion: 'graduation', category: 'retail', requirement: 'Verified student/educator', url: 'https://www.samsung.com/us/shop/discount-program/education/', howTo: 'Verify through Samsung\'s education program for discounts on phones, tablets, and laptops.' },
  { company: 'Spotify', perk: 'Student plan at 50% off ($5.99/mo)', occasion: 'graduation', category: 'entertainment', requirement: 'Enrolled at accredited college', url: 'https://www.spotify.com/us/student/', howTo: 'Verify enrollment via SheerID. Includes Hulu and Showtime.' },

  // ANNIVERSARY (membership/loyalty anniversaries)
  { company: 'Chick-fil-A', perk: 'Free treat on app anniversary', occasion: 'anniversary', category: 'food', requirement: 'Chick-fil-A One member', url: 'https://www.chick-fil-a.com/one', howTo: 'Your app anniversary reward appears automatically in the Chick-fil-A app.' },
  { company: 'Panera Bread', perk: 'Free pastry on MyPanera anniversary', occasion: 'anniversary', category: 'food', requirement: 'MyPanera member for 1+ years', url: 'https://www.panerabread.com', howTo: 'Anniversary reward automatically loads into your MyPanera account.' },
  { company: 'Starbucks', perk: 'Double-star days on member anniversary', occasion: 'anniversary', category: 'food', requirement: 'Starbucks Rewards member', url: 'https://www.starbucks.com/rewards', howTo: 'Bonus stars are awarded around your Starbucks Rewards anniversary date.' },

  // NEW BABY
  { company: 'Amazon', perk: 'Free welcome box (baby registry, ~$35 value)', occasion: 'new_baby', category: 'retail', requirement: 'Create Amazon Baby Registry + purchase $10+ from it', url: 'https://www.amazon.com/baby-reg/', howTo: 'Create an Amazon Baby Registry, add items, and purchase at least $10 worth. The Welcome Box ships free for Prime members.' },
  { company: 'Target', perk: 'Free welcome kit (coupons + samples)', occasion: 'new_baby', category: 'retail', requirement: 'Create Target Baby Registry', url: 'https://www.target.com/gift-registry/baby', howTo: 'Create a baby registry at Target. Pick up your free welcome bag of samples and coupons at Guest Services.' },
  { company: 'Buy Buy Baby / Bed Bath', perk: 'Free goody bag with samples', occasion: 'new_baby', category: 'retail', requirement: 'Create registry', url: 'https://www.buybuybaby.com', howTo: 'Create a baby registry and pick up a goody bag in-store.' },
  { company: 'Enfamil', perk: 'Free baby formula samples + up to $400 in gifts', occasion: 'new_baby', category: 'food', requirement: 'Join Enfamil Family Beginnings (free)', url: 'https://www.enfamil.com/baby-formula-coupons-samples', howTo: 'Sign up for Enfamil Family Beginnings. Formula samples, coupons, and a belly badges kit are mailed to you.' },
  { company: 'Similac', perk: 'Free formula samples + $400 in coupons/resources', occasion: 'new_baby', category: 'food', requirement: 'Join Similac StrongMoms (free)', url: 'https://www.similac.com/strongmoms-rewards.html', howTo: 'Sign up for StrongMoms Rewards for free formula samples and high-value coupons.' },
  { company: 'Babylist', perk: 'Free Hello Baby Box (samples + products)', occasion: 'new_baby', category: 'retail', requirement: 'Create Babylist registry + add items', url: 'https://www.babylist.com/hello-baby', howTo: 'Create a Babylist registry and add enough items to unlock the free Hello Baby Box.' },

  // LOYALTY / JUST FOR SIGNING UP
  { company: 'Chick-fil-A', perk: 'Free chicken sandwich (first app download)', occasion: 'signup', category: 'food', requirement: 'Download Chick-fil-A app for first time', url: 'https://www.chick-fil-a.com/one', howTo: 'Download the Chick-fil-A app and create an account. Free sandwich offer appears immediately.' },
  { company: 'Wendy\'s', perk: 'Free Dave\'s Single with any purchase', occasion: 'signup', category: 'food', requirement: 'Download Wendy\'s app', url: 'https://www.wendys.com/rewards', howTo: 'Download the Wendy\'s app and create an account for a free sandwich with any purchase.' },
  { company: 'Popeyes', perk: 'Free chicken sandwich with first app order', occasion: 'signup', category: 'food', requirement: 'Download Popeyes app', url: 'https://www.popeyes.com/app', howTo: 'Download the Popeyes app and place your first order. Free sandwich offer is automatic.' },
  { company: 'Taco Bell', perk: 'Free Doritos Locos Taco on sign-up', occasion: 'signup', category: 'food', requirement: 'Join Taco Bell Rewards', url: 'https://www.tacobell.com/rewards', howTo: 'Download the app and sign up for rewards. Free taco appears immediately.' },
  { company: 'McDonald\'s', perk: 'Free large fries with first app purchase', occasion: 'signup', category: 'food', requirement: 'Download McDonald\'s app', url: 'https://www.mcdonalds.com/us/en-us/download-app.html', howTo: 'Download the McDonald\'s app. Free large fries offer appears for your first mobile order.' },
  { company: 'Burger King', perk: 'Free Whopper with first app order', occasion: 'signup', category: 'food', requirement: 'Download BK app', url: 'https://www.bk.com/royal-perks', howTo: 'Download the BK app, sign up for Royal Perks. Free Whopper is a first-order perk.' },

  // VETERANS / MILITARY
  { company: 'Applebee\'s', perk: 'Free meal on Veterans Day', occasion: 'veterans', category: 'food', requirement: 'Military ID or proof of service', url: 'https://www.applebees.com', howTo: 'Visit on Veterans Day (November 11) with military ID. Select from a special free entrée menu.' },
  { company: 'Chili\'s', perk: 'Free entrée on Veterans Day', occasion: 'veterans', category: 'food', requirement: 'Military ID', url: 'https://www.chilis.com', howTo: 'Dine in on Veterans Day with military ID for a free entrée from a select menu.' },
  { company: 'Lowe\'s', perk: '10% military discount (year-round)', occasion: 'veterans', category: 'retail', requirement: 'Verified military status via MyLowes', url: 'https://www.lowes.com/l/military-discount.html', howTo: 'Register and verify military status on Lowes.com. 10% discount applies automatically in-store and online.' },
  { company: 'Home Depot', perk: '10% military discount (year-round)', occasion: 'veterans', category: 'retail', requirement: 'Verified military status', url: 'https://www.homedepot.com/c/Military_Background_Verification', howTo: 'Verify your military status through the Home Depot app or website for an automatic 10% discount.' },
  { company: 'Under Armour', perk: '20% military discount', occasion: 'veterans', category: 'retail', requirement: 'Military ID verification via ID.me', url: 'https://www.underarmour.com/en-us/t/military/', howTo: 'Verify military status through ID.me on Under Armour\'s website for 20% off.' },

  // SENIORS
  { company: 'Denny\'s', perk: '15% off or senior menu', occasion: 'seniors', category: 'food', requirement: 'Age 55+, show ID', url: 'https://www.dennys.com', howTo: 'Ask your server for the 55+ menu or senior discount when ordering.' },
  { company: 'IHOP', perk: 'Senior menu (reduced prices)', occasion: 'seniors', category: 'food', requirement: 'Age 55+', url: 'https://www.ihop.com', howTo: 'Request the 55+ menu when ordering for smaller portions at reduced prices.' },
  { company: 'Ross', perk: '10% off every Tuesday', occasion: 'seniors', category: 'retail', requirement: 'Age 55+', url: 'https://www.rossstores.com', howTo: 'Shop on Tuesdays and ask the cashier for the senior discount at checkout.' },
  { company: 'Goodwill', perk: 'Senior discount day (varies by location)', occasion: 'seniors', category: 'retail', requirement: 'Age varies (55-65+)', url: 'https://www.goodwill.org', howTo: 'Check your local Goodwill for senior discount days — typically a specific weekday with 10-25% off.' },
  { company: 'Walgreens', perk: 'Seniors Day (20% off store brand)', occasion: 'seniors', category: 'retail', requirement: 'Age 55+, myWalgreens member', url: 'https://www.walgreens.com', howTo: 'Shop on the first Tuesday of each month for 20% off Walgreens brand products.' },
];

export default function FreePerks() {
  const { activeProfileId } = useActiveProfile();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [occasionFilter, setOccasionFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedPerk, setSelectedPerk] = useState(null);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [copied, setCopied] = useState(null);
  const [customForm, setCustomForm] = useState({
    company: '', perk: '', occasion: 'birthday', category: 'food',
    requirement: '', url: '', howTo: '',
  });

  const { data: savedPerks = [] } = useQuery({
    queryKey: ['savedPerks', activeProfileId],
    queryFn: () => {
      const raw = localStorage.getItem(`incognito_perks_${activeProfileId || 'default'}`);
      return raw ? JSON.parse(raw) : [];
    },
  });

  const { data: claimedIds = [] } = useQuery({
    queryKey: ['claimedPerks', activeProfileId],
    queryFn: () => {
      const raw = localStorage.getItem(`incognito_claimed_${activeProfileId || 'default'}`);
      return raw ? JSON.parse(raw) : [];
    },
  });

  const claimedSet = useMemo(() => new Set(claimedIds), [claimedIds]);

  const allPerks = useMemo(() => {
    const custom = savedPerks.map(p => ({ ...p, isCustom: true }));
    return [...BUILT_IN_PERKS, ...custom];
  }, [savedPerks]);

  const filtered = useMemo(() => {
    return allPerks.filter(p => {
      if (occasionFilter !== 'all' && p.occasion !== occasionFilter) return false;
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!p.company.toLowerCase().includes(q) && !p.perk.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allPerks, occasionFilter, categoryFilter, search]);

  const savePerk = (perk) => {
    const key = `incognito_perks_${activeProfileId || 'default'}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.push({ ...perk, id: Date.now().toString() });
    localStorage.setItem(key, JSON.stringify(current));
    queryClient.invalidateQueries({ queryKey: ['savedPerks'] });
    setShowAddCustom(false);
    setCustomForm({ company: '', perk: '', occasion: 'birthday', category: 'food', requirement: '', url: '', howTo: '' });
  };

  const deletePerk = (id) => {
    const key = `incognito_perks_${activeProfileId || 'default'}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify(current.filter(p => p.id !== id)));
    queryClient.invalidateQueries({ queryKey: ['savedPerks'] });
  };

  const toggleClaimed = (perkKey) => {
    const key = `incognito_claimed_${activeProfileId || 'default'}`;
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    const next = current.includes(perkKey) ? current.filter(k => k !== perkKey) : [...current, perkKey];
    localStorage.setItem(key, JSON.stringify(next));
    queryClient.invalidateQueries({ queryKey: ['claimedPerks'] });
  };

  const getPerkKey = (p) => `${p.company}::${p.occasion}::${p.perk}`;

  const occasionCounts = useMemo(() => {
    const counts = {};
    allPerks.forEach(p => { counts[p.occasion] = (counts[p.occasion] || 0) + 1; });
    return counts;
  }, [allPerks]);

  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const getOccasion = (id) => OCCASIONS.find(o => o.id === id) || OCCASIONS[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-600 to-amber-500 flex items-center justify-center">
              <Gift className="w-6 h-6 text-white" />
            </div>
            Free Perks & Rewards
          </h1>
          <p className="text-gray-400 mt-1">Birthday freebies, graduation deals, sign-up bonuses, and more</p>
        </div>
        <Button onClick={() => setShowAddCustom(true)} className="bg-gradient-to-r from-pink-600 to-amber-500">
          <Plus className="w-4 h-4 mr-1" /> Add Custom
        </Button>
      </div>

      {/* Occasion cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {OCCASIONS.map(occ => {
          const Icon = occ.icon;
          const count = occasionCounts[occ.id] || 0;
          const isActive = occasionFilter === occ.id;
          return (
            <button
              key={occ.id}
              onClick={() => setOccasionFilter(isActive ? 'all' : occ.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? 'border-white/20 bg-gradient-to-br ' + occ.color + ' shadow-lg'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                <span className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>{occ.label}</span>
              </div>
              <p className={`text-xs ${isActive ? 'text-white/70' : 'text-gray-500'}`}>{count} perk{count !== 1 ? 's' : ''}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              placeholder="Search companies or perks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-slate-800 border-slate-600 text-white h-9 pl-9"
            />
          </div>
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 text-sm">
        <span className="text-gray-400">Showing <span className="text-white font-semibold">{filtered.length}</span> perks</span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-400">Claimed <span className="text-green-400 font-semibold">{claimedIds.length}</span></span>
      </div>

      {/* Perks list */}
      {filtered.length === 0 ? (
        <Card className="glass-card border-slate-700">
          <CardContent className="p-10 text-center">
            <Gift className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">No perks match your filter</p>
            <p className="text-gray-500 text-sm mt-1">Try a different occasion or clear your search</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((perk, idx) => {
            const occ = getOccasion(perk.occasion);
            const OccIcon = occ.icon;
            const perkKey = getPerkKey(perk);
            const claimed = claimedSet.has(perkKey);

            return (
              <Card
                key={perk.isCustom ? perk.id : `${perk.company}-${perk.occasion}-${idx}`}
                className={`glass-card overflow-hidden transition-all hover:border-slate-600 cursor-pointer ${claimed ? 'border-green-500/30 opacity-70' : 'border-slate-700'}`}
                onClick={() => setSelectedPerk(perk)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg shrink-0 flex items-center justify-center bg-gradient-to-br ${occ.color}`}>
                      <OccIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-white font-semibold text-sm truncate">{perk.company}</span>
                        {claimed && <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />}
                        {perk.isCustom && <Badge className="bg-purple-500/20 text-purple-300 border-0 text-[10px]">Custom</Badge>}
                      </div>
                      <p className="text-gray-300 text-sm leading-snug">{perk.perk}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className={`${occ.badge} border-0 text-[10px]`}>{occ.label}</Badge>
                        <Badge className="bg-slate-700/50 text-gray-400 border-0 text-[10px]">
                          {CATEGORIES.find(c => c.id === perk.category)?.label || perk.category}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Perk Detail Dialog */}
      <Dialog open={!!selectedPerk} onOpenChange={() => setSelectedPerk(null)}>
        <DialogContent className="bg-slate-900 border-red-500/30 text-white max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedPerk && (() => {
            const occ = getOccasion(selectedPerk.occasion);
            const OccIcon = occ.icon;
            const perkKey = getPerkKey(selectedPerk);
            const claimed = claimedSet.has(perkKey);

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br ${occ.color}`}>
                      <OccIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-xl">{selectedPerk.company}</div>
                      <p className="text-sm text-gray-400 font-normal">{selectedPerk.perk}</p>
                    </div>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="flex gap-2 flex-wrap">
                    <Badge className={`${occ.badge} border-0`}>{occ.label}</Badge>
                    <Badge className="bg-slate-700/50 text-gray-400 border-0">
                      {CATEGORIES.find(c => c.id === selectedPerk.category)?.label}
                    </Badge>
                  </div>

                  {selectedPerk.requirement && (
                    <Card className="bg-amber-500/10 border-amber-500/20">
                      <CardContent className="p-3 flex gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs text-amber-300 font-semibold mb-0.5">Requirement</p>
                          <p className="text-sm text-amber-200">{selectedPerk.requirement}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedPerk.howTo && (
                    <Card className="bg-slate-800/50 border-slate-700">
                      <CardContent className="p-3">
                        <p className="text-xs text-gray-400 font-semibold mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> How to Get It</p>
                        <p className="text-sm text-gray-300 leading-relaxed">{selectedPerk.howTo}</p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedPerk.url && (
                      <a href={selectedPerk.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button className="w-full bg-gradient-to-r from-blue-600 to-indigo-600" size="sm">
                          <ExternalLink className="w-4 h-4 mr-1" /> Visit / Sign Up
                        </Button>
                      </a>
                    )}
                    <Button
                      onClick={(e) => { e.stopPropagation(); toggleClaimed(perkKey); }}
                      variant={claimed ? 'outline' : 'default'}
                      size="sm"
                      className={claimed ? 'border-green-500/40 text-green-300' : 'bg-green-600 hover:bg-green-700'}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" /> {claimed ? 'Claimed' : 'Mark Claimed'}
                    </Button>
                  </div>

                  {selectedPerk.url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(selectedPerk.url, 'url')}
                      className="text-xs text-gray-500 w-full"
                    >
                      {copied === 'url' ? <CheckCircle className="w-3 h-3 mr-1 text-green-400" /> : <Copy className="w-3 h-3 mr-1" />}
                      {copied === 'url' ? 'Copied!' : 'Copy link'}
                    </Button>
                  )}

                  {selectedPerk.isCustom && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { deletePerk(selectedPerk.id); setSelectedPerk(null); }}
                      className="text-xs text-red-400 w-full hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Delete Custom Perk
                    </Button>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Add Custom Perk Dialog */}
      <Dialog open={showAddCustom} onOpenChange={setShowAddCustom}>
        <DialogContent className="bg-slate-900 border-pink-500/30 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-pink-400" /> Add Custom Perk
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Company *</label>
              <Input value={customForm.company} onChange={e => setCustomForm({ ...customForm, company: e.target.value })} placeholder="e.g. Local Coffee Shop" className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">What do you get? *</label>
              <Input value={customForm.perk} onChange={e => setCustomForm({ ...customForm, perk: e.target.value })} placeholder="e.g. Free latte on your birthday" className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Occasion</label>
                <Select value={customForm.occasion} onValueChange={v => setCustomForm({ ...customForm, occasion: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{OCCASIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Category</label>
                <Select value={customForm.category} onValueChange={v => setCustomForm({ ...customForm, category: v })}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Requirement</label>
              <Input value={customForm.requirement} onChange={e => setCustomForm({ ...customForm, requirement: e.target.value })} placeholder="e.g. Must show ID" className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Website URL</label>
              <Input value={customForm.url} onChange={e => setCustomForm({ ...customForm, url: e.target.value })} placeholder="https://..." className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">How to get it</label>
              <Input value={customForm.howTo} onChange={e => setCustomForm({ ...customForm, howTo: e.target.value })} placeholder="Step-by-step instructions..." className="bg-slate-800 border-slate-600 text-white h-9" />
            </div>
            <Button
              onClick={() => savePerk(customForm)}
              disabled={!customForm.company || !customForm.perk}
              className="w-full bg-gradient-to-r from-pink-600 to-amber-500"
            >
              Save Perk
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
