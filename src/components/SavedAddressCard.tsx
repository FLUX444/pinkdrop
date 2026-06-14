import { MapPin, Pencil } from 'lucide-react';

interface SavedAddressCardProps {
  address: string;
  onEdit: () => void;
  editLabel?: string;
}

export function SavedAddressCard({ address, onEdit, editLabel = 'Изменить адрес' }: SavedAddressCardProps) {
  return (
    <div className="saved-address-card">
      <span className="saved-address-card__icon" aria-hidden>
        <MapPin size={18} />
      </span>
      <div className="saved-address-card__copy">
        <span className="saved-address-card__label mono">SAVED_ADDRESS</span>
        <p>{address}</p>
      </div>
      <button
        type="button"
        className="saved-address-card__edit"
        onClick={onEdit}
        aria-label={editLabel}
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}
