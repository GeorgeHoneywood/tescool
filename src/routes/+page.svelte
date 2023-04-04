<script lang="ts">
	import type { PageData } from './$types';
	import type { Item } from './+page.server';
	import { onMount } from 'svelte';

	export let data: PageData;

	let loading = true;
	let items : Item[] | null = null;
	let index = 0;

	let guess: number | null = null;
	let submitted = false;
	let finished = false;

	let score = 0;

	const roundBrackets: Record<number, { text: string; color: string }> = {
		5: { text: 'Dead on!', color: 'green' },
		15: { text: 'Close!', color: 'blue' },
		25: { text: 'Not bad!', color: 'orange' },
		50: { text: 'Not too far off!', color: 'orange' },
		Infinity: { text: "You're a disgrace!", color: 'red' }
	};

	let percentOff = 0;
	let roundBracket = { text: "You're a disgrace!", color: 'red' };

	const checkGuess = () => {
		if (guess === null || items === null) {
			return;
		}
		submitted = true;
		percentOff = Math.abs(((guess - items[index].price) / items[index].price) * 100);
		let key = Object.keys(roundBrackets).find((e) => {
			return percentOff < +e;
		});

		roundBracket = roundBrackets[+(key ?? Infinity)];

		console.log('guess', percentOff, roundBracket);
		console.log(percentOff);
		score += (100 - percentOff) * 10;
		console.log('submit guess', score);
	};

	const focus = (el: HTMLElement) => {
		el.focus();
	};

	const next = () => {
		if (items === null) {
			return;
		}

		index++;
		if (index >= items.length) {
			finished = true;
			return;
		}
		guess = null;
		submitted = false;
	};

	onMount(async () => {
		items = await data.streamed.items;
		loading = false;
	});
</script>

<main>
	<h1>Tescool!</h1>
	<p>Guess the price of the Tesco item</p>

	{#if loading}
		<p>Loading...</p>
	{:else if !finished && items}
		<div class="item-box">
			<span>Score: {score.toFixed(0)}/5000</span>
			<img src={items[index].defaultImageUrl} alt="Image of {items[index].title}" />
			<span class="name">{items[index].title}</span>

			<div class="guess">
				<span>Guess: £</span>
				<input
					class="guess-input"
					type="number"
					min="0.00"
					max="10000.00"
					step="0.01"
					placeholder="0.23"
					bind:value={guess}
					on:keypress={(e) => {
						if (e.key === 'Enter') {
							!submitted ? checkGuess() : next();
						}
					}}
					use:focus
				/>
				{#if !submitted}
					<button on:click={() => checkGuess()} disabled={!guess}>Submit</button>
				{:else}
					<button on:click={() => next()}>Next</button>
				{/if}
			</div>

			{#if submitted}
				<div class="actual" style="color: {submitted ? roundBracket.color : 'black'}">
					<span>Actual price:</span>

					<span class="price">{items[index].price.toFixed(2)}</span>
					<span>{percentOff.toFixed(0)}% off &mdash; {roundBracket.text}</span>
				</div>
			{/if}
		</div>
	{:else}
		<h2>Round complete!</h2>
		<p>Your score is {score.toFixed(0)}/5000</p>

		<button on:click={() => window.location.reload()}>Play again!</button>
	{/if}
</main>

<style>
	main {
		max-width: 600px;
		margin: auto;
	}

	.item-box {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.item-box > * {
		margin-bottom: 0.5rem;
	}

	.price::before {
		content: '£';
	}

	img {
		width: 250px;
		height: 250px;
	}
	.name {
		font-style: italic;
	}
	.guess-input {
		max-width: 100px;
	}

	input,
	button {
		padding: 4px;
	}
</style>
