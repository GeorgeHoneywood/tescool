<script lang="ts">
	import type { PageData } from './$types';
	import { onMount } from 'svelte';
	import Spinner from '../components/Spinner.svelte';
	import { invalidateAll } from '$app/navigation';
	import { getLocalTodayString, type Item } from '../util';
	import { slide } from 'svelte/transition';

	export let data: PageData;

	let loading = true;
	let items: Item[] | null = null;
	let index = 0;
	let type = '';

	let guess: number | null = null;
	let submitted = false;
	let finished = false;

	let score = 0;
	let newHighscore = false;

	let percentOff = 0;
	let roundBracket = { text: '', color: 'black' };

	let newDayChecker = 0;

	const roundBrackets: Record<number, { text: string; color: string }> = {
		5: { text: 'Dead on!', color: 'green' },
		15: { text: 'Close!', color: 'blue' },
		25: { text: 'Not bad!', color: 'orange' },
		50: { text: 'Not too far off!', color: 'orange' },
		Infinity: { text: 'Disgraceful!', color: 'red' }
	};

	const checkGuess = () => {
		if (guess === null || items === null) {
			return;
		}
		submitted = true;
		percentOff = Math.abs(((guess - items[index].price) / items[index].price) * 100);
		let key = Object.keys(roundBrackets)
			.sort()
			.find((e) => {
				return percentOff < +e;
			});

		roundBracket = roundBrackets[+(key ?? Infinity)];

		score += Math.max(100 - percentOff, 0.5) * 10;
	};

	const focus = (el: HTMLElement) => {
		el.focus({ preventScroll: true });
	};

	const next = () => {
		if (items === null) {
			return;
		}

		index++;
		if (index >= items.length) {
			finished = true;

			// if daily challenge
			if (type === 'daily') {
				localStorage.setItem('dailyChallengeDate', getLocalTodayString());
			}

			// do highscore stuff here
			if (
				localStorage.getItem('highscore') === null ||
				score > +localStorage.getItem('highscore')!
			) {
				localStorage.setItem('highscore', score.toFixed(0));
				newHighscore = true;
			}

			// check if there is a new daily challenge every 2 seconds
			newDayChecker = setInterval(() => {
				if (data.loadDate !== getLocalTodayString()) {
					console.log('the date has changed');
					loading = true;
					invalidateAll().then(async () => {
						console.log('loaded new daily challenge');

						await resetState();
					});
				}
			}, 1000 * 2);

			return;
		}
		guess = null;
		submitted = false;
	};

	onMount(async () => {
		await resetState();
	});

	const getImageUrl = (e: Item): string => {
		return window.devicePixelRatio === 1 ? e.x1ImageUrl : e.x2ImageUrl;
	};

	const resetState = async () => {
		const resp = await data.streamed.tesco;
		items = resp.items;
		type = resp.type;
		loading = false;

		finished = false;
		submitted = false;
		index = 0;
		score = 0;
		guess = null;
		newHighscore = false;

		// precache images
		items.forEach((e) => {
			new Image().src = getImageUrl(e);
		});
	};
</script>

<main>
	<h1>Tescool: {type !== '' ? (type === 'daily' ? 'daily' : 'free play') : ''}</h1>
	{#if loading}
		<div class="spinner">
			<Spinner />
		</div>
	{:else if !finished && items}
		<div class="stats">
			<span>Round: {index + 1}/5</span>
			<span style="text-align:right">Score: {score.toFixed(0)}/5000</span>
		</div>

		{#key items[index]}
			<div class="item-box" transition:slide|local>
				<img src={getImageUrl(items[index])} alt="Image of {items[index].title}" />

				<span class="name">{items[index].title}</span>
			</div>
		{/key}

		<div class="guess">
			<span>
				<span>£</span>
				<!-- key this so that autofocus works properly -->
				{#key items[index]}
					<input
						class="guess-input"
						type="number"
						min="0.00"
						max="10000.00"
						step="0.01"
						placeholder="1.34"
						autocomplete="no"
						bind:value={guess}
						on:keypress={(e) => {
							if (e.key === 'Enter') {
								!submitted ? checkGuess() : next();
							}
						}}
						use:focus
					/>
				{/key}
			</span>

			{#if !submitted}
				<button class="guess-button" on:click={() => checkGuess()} disabled={!guess}>Submit</button>
			{:else}
				<button class="guess-button" on:click={() => next()}>Next</button>
			{/if}
		</div>

		{#if submitted}
			<div class="actual" style="color: {submitted ? roundBracket.color : 'black'}">
				<span
					>Actual price: £{items[index].price.toFixed(2)} &mdash; {percentOff.toFixed(0)}% off</span
				>

				<span>{roundBracket.text}</span>
			</div>
		{/if}
	{:else}
		<h2>Game complete!</h2>
		<p>You scored {score.toFixed(0)}/5000</p>

		{#if newHighscore}
			<p>New highscore!</p>
		{:else}
			<p>Highscore: {localStorage.getItem('highscore') ?? 0}</p>
		{/if}

		<button
			class="new-game"
			use:focus
			disabled={loading}
			on:click={() => {
				// prevent auto reload if we are mid-game
				if (newDayChecker !== 0) {
					clearInterval(newDayChecker);
				}

				loading = true;
				document.cookie = `dailyChallengeDate=${getLocalTodayString()}; SameSite=Lax`;

				invalidateAll().then(async () => {
					console.log('loaded random items');

					await resetState();
				});
			}}
		>
			Play random game!
		</button>
	{/if}
</main>

<style>
	main {
		max-width: 400px;
		margin: auto;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	h1,
	h2,
	p {
		text-align: center;
	}

	h1 {
		margin: 10px 10px;
	}

	.item-box {
		display: flex;
		flex-direction: column;
		/* justify-content: space-between; */
		align-items: center;
		flex: auto;
	}

	.item-box > * {
		margin-bottom: 0.5rem;
	}

	img {
		width: 250px;
		height: 250px;
		margin: 10px auto;
	}

	.name {
		font-style: italic;
		text-align: center;
		height: 60px;
		overflow: hidden;
		text-overflow: ellipsis;
		margin: auto 20px;

		display: flex;
		justify-content: center;
		align-items: center;
	}

	.guess {
		display: flex;
		justify-content: space-between;
		/* width: 100%; */
		margin: auto 20px;
	}

	.guess-input {
		width: 85px;
		font-size: inherit;
	}

	input,
	button {
		padding: 6px;
		font-size: inherit;
	}

	.stats {
		display: flex;
		justify-content: space-between;
		margin: auto 20px;
	}

	.spinner {
		display: flex;
		justify-content: center;
		align-items: center;
	}

	.actual {
		margin: 10px;
		text-align: center;
		display: flex;
		flex-direction: column;
	}

	.new-game {
		margin: 15px;
	}

	.guess-button {
		min-width: 100px;
	}
</style>
