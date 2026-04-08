import * as React from 'react';
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Copy01Icon,
  CreditCardIcon,
  Database01Icon,
  Delete02Icon,
  FavouriteIcon,
  File01Icon,
  FileAddIcon,
  Folder01Icon,
  FolderAddIcon,
  FolderOpenIcon,
  GitMergeIcon,
  HardDriveIcon,
  HashtagIcon,
  InboxIcon,
  LeftToRightBlockQuoteIcon,
  LinkSquare02Icon,
  Loading03Icon,
  Login01Icon,
  MapPinIcon,
  MapsLocation01Icon,
  MoreVerticalIcon,
  PaintBoardIcon,
  PencilEdit02Icon,
  RadioIcon,
  Search01Icon,
  Settings02Icon,
  StickyNote01Icon,
  Tag01Icon,
  Tick02Icon,
  UserCircle02Icon,
  type IconSvgElement,
} from '@hugeicons/core-free-icons';
import { HugeIcon } from '@/components/ui/huge-icon';

type IconComponent = React.ForwardRefExoticComponent<
  Omit<React.ComponentPropsWithoutRef<typeof HugeIcon>, 'icon'> & React.RefAttributes<SVGSVGElement>
>;

function alias(icon: IconSvgElement): IconComponent {
  return React.forwardRef<SVGSVGElement, Omit<React.ComponentPropsWithoutRef<typeof HugeIcon>, 'icon'>>(
    (props, ref) => <HugeIcon ref={ref} icon={icon} {...props} />
  );
}

export const Plus = alias(Add01Icon);
export const ChevronDown = alias(ArrowDown01Icon);
export const ArrowLeft = alias(ArrowLeft01Icon);
export const ChevronRight = alias(ArrowRight01Icon);
export const X = alias(Cancel01Icon);
export const Copy = alias(Copy01Icon);
export const CreditCard = alias(CreditCardIcon);
export const Database = alias(Database01Icon);
export const Trash2 = alias(Delete02Icon);
export const Star = alias(FavouriteIcon);
export const FileText = alias(File01Icon);
export const FilePlus2 = alias(FileAddIcon);
export const Folder = alias(Folder01Icon);
export const FolderPlus = alias(FolderAddIcon);
export const FolderOpen = alias(FolderOpenIcon);
export const GitMerge = alias(GitMergeIcon);
export const HardDrive = alias(HardDriveIcon);
export const Hash = alias(HashtagIcon);
export const Inbox = alias(InboxIcon);
export const PanelsTopLeft = alias(LeftToRightBlockQuoteIcon);
export const ExternalLink = alias(LinkSquare02Icon);
export const LoaderCircle = alias(Loading03Icon);
export const LogIn = alias(Login01Icon);
export const Pin = alias(MapPinIcon);
export const MapPinned = alias(MapsLocation01Icon);
export const MoreVertical = alias(MoreVerticalIcon);
export const Palette = alias(PaintBoardIcon);
export const Pencil = alias(PencilEdit02Icon);
export const Circle = alias(RadioIcon);
export const Search = alias(Search01Icon);
export const Settings2 = alias(Settings02Icon);
export const StickyNote = alias(StickyNote01Icon);
export const Tag = alias(Tag01Icon);
export const Tags = alias(Tag01Icon);
export const Check = alias(Tick02Icon);
export const UserRound = alias(UserCircle02Icon);
