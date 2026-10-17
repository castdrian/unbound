import { IconZoom } from '@tabler/icons-react';
import type { FormEvent } from 'react';
import { useState } from 'react';

import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group';
import { Button } from '~/components/ui/button';

type SearchFormProps = {
	search: string;
	placeholder: string;
	onSearch: (search: string) => void;
};

function SearchForm({ search, placeholder, onSearch }: SearchFormProps) {
	const [value, setValue] = useState(search);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSearch(value.trim());
	}

	return (
		<form onSubmit={submit} className='flex gap-2'>
			<InputGroup className='max-w-sm'>
				<InputGroupAddon>
					<IconZoom />
				</InputGroupAddon>
				<InputGroupInput
					placeholder={placeholder}
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
			</InputGroup>
			<Button type='submit' variant='secondary'>
				Search
			</Button>
		</form>
	);
}

export default SearchForm;
